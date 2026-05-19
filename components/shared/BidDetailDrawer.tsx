'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ExternalLinkIcon, PlusIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { STATUS_BADGE_CLASSES, SCOPE_BADGE_CLASSES } from '@/config/colors'
import type { BidStatus, BidLineItem } from '@/hooks/useBids'
import type { Branch as BranchType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SmartDateInput } from '@/components/ui/SmartDateInput'
import { ScopeEditor } from '@/components/spreadsheet/ScopeEditor'
import { ClientsPopover } from '@/components/spreadsheet/ClientsPopover'
import { DocumentsSection } from '@/components/bids/DocumentsSection'
import { InlinePriceCell } from '@/components/bids/InlinePriceCell'
import { InlineScopeEstimatorCell } from '@/components/bids/InlineScopeEstimatorCell'
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
  project_location: z.string().optional(),
  mike_estimate_number: z.string().optional(),
  branch: z.enum(['PSC', 'SEA', 'POR', 'PHX', 'SLC']),
  status: z.enum(['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Verbal', 'Awarded', 'Lost']),
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
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile } = useUserRole()
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
        project_location: selectedBid.project_location ?? '',
        mike_estimate_number: selectedBid.mike_estimate_number ?? '',
        branch: selectedBid.branch,
        status: selectedBid.status,
        estimator_id: estimatorId ?? undefined,
        bid_due_date: selectedBid.bid_due_date,
      })
    }

    populate()
    return () => { cancelled = true }
  }, [selectedBid, reset])

  // Re-fetch the selected bid (line items + clients) and push it back into the
  // shared bid state. Used by the realtime subscription and after a ScopeEditor
  // save, so the drawer reflects scope changes without a page refresh.
  async function refreshSelectedBid() {
    if (!selectedBid?.id) return
    const supabase = createClient()
    const { data } = await supabase
      .from('bids')
      .select(`
        *,
        profiles!bids_estimator_id_fkey(name),
        bid_line_items(*),
        bid_clients(*, clients(name))
      `)
      .eq('id', selectedBid.id)
      .single()
    if (!data) return
    const row = data as any
    const line_items: BidLineItem[] = row.bid_line_items ?? []
    const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
    openBid({
      ...row,
      estimator_name: row.profiles?.name ?? null,
      line_items,
      clients: row.bid_clients ?? [],
      total_price,
    })
  }

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
        () => { void refreshSelectedBid() },
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
        project_location: values.project_location?.trim() ? values.project_location.trim() : null,
        mike_estimate_number: values.mike_estimate_number?.trim() ? values.mike_estimate_number.trim() : null,
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

  // ─── Scope line-item helpers ──────────────────────────────────────────────
  // InlinePriceCell / InlineScopeEstimatorCell persist their own changes to
  // supabase; these callbacks mirror the edit into the shared bid state so the
  // drawer's rows and Bid Total update immediately (same optimistic pattern as
  // BidDetailClient, applied to the context-owned selectedBid).

  function updateLineItemPrice(lineItemId: string, price: number | null) {
    if (!selectedBid?.line_items) return
    const line_items = selectedBid.line_items.map((li) =>
      li.id === lineItemId ? { ...li, price } : li,
    )
    const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
    openBid({ ...selectedBid, line_items, total_price })
  }

  function updateLineItemEstimator(lineItemId: string, estimatorId: string | null) {
    if (!selectedBid?.line_items) return
    const line_items = selectedBid.line_items.map((li) =>
      li.id === lineItemId ? { ...li, estimator_id: estimatorId } : li,
    )
    openBid({ ...selectedBid, line_items })
  }

  async function removeLineItem(lineItemId: string) {
    if (!selectedBid?.line_items) return
    const prevBid = selectedBid
    const line_items = selectedBid.line_items.filter((li) => li.id !== lineItemId)
    const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
    openBid({ ...selectedBid, line_items, total_price })

    const supabase = createClient()
    const { error } = await supabase.from('bid_line_items').delete().eq('id', lineItemId)
    if (error) {
      openBid(prevBid)
      toast.error('Failed to delete scope line item.')
    }
  }

  // Scope-only line items (no per-client rows) — the editable Scope Pricing list.
  const scopeItems = (selectedBid?.line_items ?? []).filter((li) => !li.client)

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
              <SheetClose asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close">
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
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

                {/* Project Location + MIKE Estimate # */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="dd-project_location">Project Location</Label>
                    <Input
                      id="dd-project_location"
                      {...register('project_location')}
                      placeholder="City, State or full address"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dd-mike_estimate_number">MIKE Estimate #</Label>
                    <Input
                      id="dd-mike_estimate_number"
                      {...register('mike_estimate_number')}
                      placeholder="e.g. 181656"
                    />
                  </div>
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
                            {(['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Verbal', 'Awarded', 'Lost'] as const).map((s) => (
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

                {/* Scopes + Pricing — each scope row has an inline-editable
                    price cell (InlinePriceCell), matching the full Project
                    Detail page. ScopeEditor stays as the add/remove-scopes UI. */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Scopes &amp; Pricing</Label>
                    {scopeItems.length > 0 && (
                      <ScopeEditor
                        bid={selectedBid}
                        onSaved={refreshSelectedBid}
                        trigger={
                          <Button variant="outline" size="sm" type="button">
                            <PlusIcon className="size-3.5 mr-1" />
                            Add Scope
                          </Button>
                        }
                      />
                    )}
                  </div>

                  {scopeItems.length === 0 ? (
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
                      <ScopeEditor
                        bid={selectedBid}
                        onSaved={refreshSelectedBid}
                        placeholder={
                          <span className="italic text-muted-foreground text-xs">
                            Click to add scopes &amp; prices
                          </span>
                        }
                        triggerClassName="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                      {scopeItems.map((li) => (
                        <div
                          key={li.id}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5 border-b border-[var(--border)] px-2.5 py-1.5 last:border-b-0"
                        >
                          <Badge
                            className={SCOPE_BADGE_CLASSES[li.scope]}
                            variant="outline"
                            style={{ fontSize: '0.7rem' }}
                          >
                            {li.scope}
                          </Badge>
                          <InlineScopeEstimatorCell
                            lineItemId={li.id}
                            bidId={selectedBid.id}
                            userId={profile?.id ?? null}
                            scope={li.scope}
                            initialEstimatorId={li.estimator_id}
                            leadEstimatorName={selectedBid.estimator_name}
                            onChange={updateLineItemEstimator}
                          />
                          <InlinePriceCell
                            lineItemId={li.id}
                            bidId={selectedBid.id}
                            userId={profile?.id ?? null}
                            scope={li.scope}
                            initialPrice={li.price}
                            onChange={updateLineItemPrice}
                          />
                          <button
                            type="button"
                            onClick={() => removeLineItem(li.id)}
                            aria-label={`Delete scope ${li.scope}`}
                            className="flex size-6 items-center justify-center rounded text-[var(--red,#dc2626)] opacity-60 transition-opacity hover:bg-[rgba(220,38,38,0.08)] hover:opacity-100"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                      onSaved={refreshSelectedBid}
                      placeholder={
                        <span className="italic text-muted-foreground text-sm">
                          Click to add clients
                        </span>
                      }
                      triggerClassName="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors text-sm"
                    />
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-1">
                  <Label>Documents</Label>
                  <DocumentsSection bidId={selectedBid.id} />
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
            <SheetClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
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
