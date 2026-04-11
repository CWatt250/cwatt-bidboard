'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ExternalLinkIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { STATUS_BADGE_CLASSES } from '@/config/colors'
import type { BidStatus, BidLineItem } from '@/hooks/useBids'
import type { Branch as BranchType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SmartDateInput } from '@/components/ui/SmartDateInput'
import { ScopePricingPopover } from '@/components/spreadsheet/ScopePricingPopover'
import { ClientsPopover } from '@/components/spreadsheet/ClientsPopover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANCHES = ['PSC', 'SEA', 'POR', 'PHX', 'SLC'] as const

const BRANCH_LABELS: Record<string, string> = {
  PSC: 'Pasco, WA',
  SEA: 'Seattle, WA',
  POR: 'Portland, OR',
  PHX: 'Phoenix, AZ',
  SLC: 'Salt Lake City, UT',
}

const bidDetailSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  branch: z.enum(['PSC', 'SEA', 'POR', 'PHX', 'SLC']),
  status: z.enum(['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']),
  estimator_id: z.string().nullable().optional(),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

type BidDetailForm = z.infer<typeof bidDetailSchema>

// ─── DeleteConfirmDialog ──────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  deleting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectName: string
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete bid?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{projectName}</strong>? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── BidDetailDrawer ──────────────────────────────────────────────────────────

export function BidDetailDrawer() {
  const router = useRouter()
  const { selectedBid, profiles, closeBid, openBid } = useBidDetail()
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches } = useUserRole()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Estimator dropdown options based on role
  const estimatorProfiles = (() => {
    if (isAdmin) return profiles
    if (isBranchManager) {
      return profiles.filter((p) =>
        (p.branches ?? []).some((b) => userBranches.includes(b as BranchType))
      )
    }
    return []
  })()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BidDetailForm>({
    resolver: zodResolver(bidDetailSchema),
  })

  // Re-populate form whenever the selected bid changes
  useEffect(() => {
    if (!selectedBid) return
    let cancelled = false

    async function populate() {
      if (!selectedBid) return
      let estimatorId = selectedBid.estimator_id ?? null
      if (!estimatorId) {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (data?.user?.id) estimatorId = data.user.id
      }
      if (cancelled) return
      reset({
        project_name: selectedBid.project_name,
        branch: selectedBid.branch,
        status: selectedBid.status,
        estimator_id: estimatorId ?? undefined,
        bid_due_date: selectedBid.bid_due_date,
      })
    }

    populate()
    return () => { cancelled = true }
  }, [selectedBid, reset])

  // Real-time: listen for bid_line_items changes and refresh the selected bid
  useEffect(() => {
    if (!selectedBid) return
    const supabase = createClient()

    const channel = supabase
      .channel(`drawer-line-items-${selectedBid.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bid_line_items',
          filter: `bid_id=eq.${selectedBid.id}`,
        },
        async () => {
          // Re-fetch the bid with updated line items
          const { data } = await supabase
            .from('bids')
            .select(`
              id,
              project_name,
              branch,
              estimator_id,
              status,
              bid_due_date,
              project_start_date,
              notes,
              created_at,
              updated_at,
              profiles!bids_estimator_id_fkey(name),
              bid_line_items(*)
            `)
            .eq('id', selectedBid.id)
            .single()

          if (!data) return
          const line_items: BidLineItem[] = (data as any).bid_line_items ?? []
          const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
          openBid({
            ...(data as any),
            estimator_name: (data as any).profiles?.name ?? null,
            line_items,
            total_price,
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedBid?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: BidDetailForm) {
    if (!selectedBid) return
    setSaving(true)
    const supabase = createClient()

    // Update parent bid
    const { error: bidError } = await supabase
      .from('bids')
      .update({
        project_name: values.project_name,
        branch: values.branch,
        status: values.status,
        estimator_id: values.estimator_id ?? null,
        bid_due_date: values.bid_due_date,
      })
      .eq('id', selectedBid.id)

    if (bidError) {
      setSaving(false)
      toast.error('Failed to save changes. Please try again.')
      return
    }

    setSaving(false)
    toast.success('Bid updated successfully.')
    closeBid()
  }

  async function handleDelete() {
    if (!selectedBid) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('bids').delete().eq('id', selectedBid.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete bid.')
      return
    }
    toast.success('Bid deleted.')
    setDeleteOpen(false)
    closeBid()
  }

  const isOpen = selectedBid !== null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeBid() }}>
        <SheetContent>
          {/* Header */}
          <SheetHeader>
            <div className="flex flex-col gap-1.5 min-w-0">
              <SheetTitle>{selectedBid?.project_name ?? ''}</SheetTitle>
              {selectedBid && (
                <Badge
                  className={STATUS_BADGE_CLASSES[selectedBid.status as BidStatus]}
                  variant="outline"
                >
                  {selectedBid.status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedBid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    closeBid()
                    router.push(`/dashboard/bids/${selectedBid.id}`)
                  }}
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open Full Page
                </Button>
              )}
              <SheetClose
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Close" />
                }
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Body */}
          {selectedBid && (
            <form
              id="bid-detail-form"
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-1 overflow-hidden"
            >
              {/* Main fields */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 w-full">
                {/* Project Name */}
                <div className="space-y-1">
                  <Label htmlFor="dd-project_name">Project Name</Label>
                  <Input
                    id="dd-project_name"
                    {...register('project_name')}
                    placeholder="Project name"
                  />
                  {errors.project_name && (
                    <p className="text-xs text-destructive">{errors.project_name.message}</p>
                  )}
                </div>

                {/* Bid Total (calculated, read-only) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    Bid Total
                  </span>
                  <span
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--text)',
                      fontFamily: '"IBM Plex Mono", monospace',
                    }}
                  >
                    {(selectedBid.line_items ?? []).some((li) => li.price !== null)
                      ? formatCurrency(selectedBid.total_price ?? 0)
                      : 'TBD'}
                  </span>
                </div>

                {/* Branch + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Branch</Label>
                    <Controller
                      name="branch"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRANCHES.map((b) => (
                              <SelectItem key={b} value={b}>{BRANCH_LABELS[b]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.branch && (
                      <p className="text-xs text-destructive">{errors.branch.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {(['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost'] as const).map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.status && (
                      <p className="text-xs text-destructive">{errors.status.message}</p>
                    )}
                  </div>
                </div>

                {/* Estimator */}
                <div className="space-y-1">
                  <Label>Estimator</Label>
                  {isEstimator ? (
                    <div className="h-9 px-3 flex items-center rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                      {selectedBid?.estimator_name ?? 'Unassigned'}
                    </div>
                  ) : (
                    <Controller
                      name="estimator_id"
                      control={control}
                      render={({ field }) => {
                        const displayName = (() => {
                          if (!field.value) return null
                          return (
                            estimatorProfiles.find(p => p.id === field.value)?.name ??
                            profiles.find(p => p.id === field.value)?.name ??
                            null
                          )
                        })()
                        return (
                          <Select
                            value={field.value ?? '__none__'}
                            onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                          >
                            <SelectTrigger className="w-full">
                              {displayName
                                ? <span>{displayName}</span>
                                : <span className="italic text-muted-foreground">Unassigned</span>
                              }
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="italic text-muted-foreground">Unassigned</span>
                              </SelectItem>
                              {estimatorProfiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      }}
                    />
                  )}
                </div>

                {/* Bid Due Date */}
                <div className="space-y-1">
                  <Label htmlFor="dd-bid_due_date">Bid Due Date</Label>
                  <Controller
                    name="bid_due_date"
                    control={control}
                    render={({ field }) => (
                      <SmartDateInput
                        id="dd-bid_due_date"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}
                  />
                  {errors.bid_due_date && (
                    <p className="text-xs text-destructive">{errors.bid_due_date.message}</p>
                  )}
                </div>

                {/* Scopes + Pricing */}
                <div className="space-y-1">
                  <Label>Scopes &amp; Pricing</Label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 36,
                      padding: '6px 10px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <ScopePricingPopover
                      bid={selectedBid}
                      placeholder={
                        <span className="italic text-muted-foreground text-xs">
                          Click to add scopes &amp; prices
                        </span>
                      }
                      triggerClassName="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
                    />
                  </div>
                </div>

                {/* Clients */}
                <div className="space-y-1">
                  <Label>Clients</Label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 36,
                      padding: '6px 10px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <ClientsPopover
                      bid={selectedBid}
                      placeholder={
                        <span className="italic text-muted-foreground text-sm">
                          Click to add clients
                        </span>
                      }
                      triggerClassName="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>

            </form>
          )}

          {/* Footer */}
          <SheetFooter>
            {isAdmin && (
              <Button
                variant="destructive"
                type="button"
                onClick={() => setDeleteOpen(true)}
              >
                Delete Bid
              </Button>
            )}
            <div className="flex-1" />
            <SheetClose render={<Button variant="outline" type="button" />}>
              Cancel
            </SheetClose>
            <Button type="submit" form="bid-detail-form" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {selectedBid && (
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          projectName={selectedBid.project_name}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

    </>
  )
}
