'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ExternalLinkIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { SCOPE_BADGE_CLASSES, STATUS_BADGE_CLASSES } from '@/config/colors'
import type { BidScope, BidStatus, BidLineItem } from '@/hooks/useBids'
import type { Branch as BranchType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SmartDateInput } from '@/components/ui/SmartDateInput'
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

const SCOPES: BidScope[] = ['Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other']

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  id: z.string().optional(), // undefined = new row
  client: z.string().min(1, 'Required'),
  scope: z.enum(['Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other'] as const),
  price: z.string().optional(),
})

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
  project_start_date: z.string().optional(),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

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
  const [deleteLineItemIndex, setDeleteLineItemIndex] = useState<number | null>(null)

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
    watch,
    formState: { errors },
  } = useForm<BidDetailForm>({
    resolver: zodResolver(bidDetailSchema),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  // Re-populate form whenever the selected bid changes
  useEffect(() => {
    if (!selectedBid) return
    reset({
      project_name: selectedBid.project_name,
      branch: selectedBid.branch,
      status: selectedBid.status,
      estimator_id: selectedBid.estimator_id ?? undefined,
      bid_due_date: selectedBid.bid_due_date,
      project_start_date: selectedBid.project_start_date ?? '',
      notes: selectedBid.notes ?? '',
      line_items: (selectedBid.line_items ?? []).length > 0
        ? (selectedBid.line_items ?? []).map((li) => ({
            id: li.id,
            client: li.client,
            scope: li.scope,
            price: li.price?.toString() ?? '',
          }))
        : [{ id: undefined, client: '', scope: undefined as any, price: '' }],
    })
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

  const watchedItems = watch('line_items') ?? []
  const totalPreview = watchedItems.reduce((sum, item) => {
    const p = parseFloat(item.price ?? '')
    return sum + (isNaN(p) ? 0 : p)
  }, 0)
  const hasAnyPrice = watchedItems.some((item) => {
    const p = parseFloat(item.price ?? '')
    return !isNaN(p)
  })

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
        project_start_date: values.project_start_date?.trim() || null,
        notes: values.notes?.trim() || null,
      })
      .eq('id', selectedBid.id)

    if (bidError) {
      setSaving(false)
      toast.error('Failed to save changes. Please try again.')
      return
    }

    // Upsert line items
    const lineItemsToUpsert = values.line_items.map((li) => ({
      ...(li.id ? { id: li.id } : {}),
      bid_id: selectedBid.id,
      client: li.client,
      scope: li.scope,
      price: li.price?.trim() ? parseFloat(li.price) : null,
    }))

    const { error: liError } = await supabase
      .from('bid_line_items')
      .upsert(lineItemsToUpsert, { onConflict: 'id' })

    if (liError) {
      setSaving(false)
      toast.error('Failed to save line items. Please try again.')
      return
    }

    // Delete line items that were removed (present in DB but not in form)
    const formIds = new Set(values.line_items.map((li) => li.id).filter(Boolean))
    const deletedIds = (selectedBid.line_items ?? [])
      .map((li) => li.id)
      .filter((id) => !formIds.has(id))

    if (deletedIds.length > 0) {
      await supabase.from('bid_line_items').delete().in('id', deletedIds)
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
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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

                {/* Bid Due Date + Project Start Date */}
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-1">
                    <Label htmlFor="dd-project_start_date">Project Start (optional)</Label>
                    <Controller
                      name="project_start_date"
                      control={control}
                      render={({ field }) => (
                        <SmartDateInput
                          id="dd-project_start_date"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <Label>Line Items</Label>
                  {errors.line_items?.root && (
                    <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
                  )}

                  <div className="border rounded-md overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                      <span>Client</span>
                      <span>Scope</span>
                      <span>Price</span>
                      <span />
                    </div>

                    {/* Table rows */}
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 px-3 py-2 items-start border-b last:border-b-0"
                      >
                        {/* Hidden: preserve database ID for existing rows */}
                        <input type="hidden" {...register(`line_items.${index}.id`)} />
                        <div>
                          <Input
                            {...register(`line_items.${index}.client`)}
                            placeholder="Client"
                            className="h-7 text-xs px-2"
                          />
                          {errors.line_items?.[index]?.client && (
                            <p className="text-xs text-destructive mt-0.5">
                              {errors.line_items[index]?.client?.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <Controller
                            name={`line_items.${index}.scope`}
                            control={control}
                            render={({ field: scopeField }) => (
                              <Select value={scopeField.value} onValueChange={(v) => scopeField.onChange(v)}>
                                <SelectTrigger className="w-full h-7 text-xs">
                                  <SelectValue placeholder="Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SCOPES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      <span className={`inline-flex items-center rounded px-1 text-xs ${SCOPE_BADGE_CLASSES[s]}`}>
                                        {s}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.line_items?.[index]?.scope && (
                            <p className="text-xs text-destructive mt-0.5">
                              {errors.line_items[index]?.scope?.message}
                            </p>
                          )}
                        </div>

                        <Input
                          {...register(`line_items.${index}.price`)}
                          type="number"
                          step="1"
                          min="0"
                          placeholder="TBD"
                          className="h-7 text-xs px-2"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (fields.length === 1) {
                              setDeleteLineItemIndex(index)
                            } else {
                              remove(index)
                            }
                          }}
                          aria-label="Remove line item"
                        >
                          <Trash2Icon className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: undefined, client: '', scope: undefined as any, price: '' })}
                  >
                    <PlusIcon className="size-3.5" />
                    Add Line Item
                  </Button>

                  {/* Running total */}
                  <div className="flex items-center justify-end pt-1 border-t">
                    <span className="text-sm text-muted-foreground mr-2">Total:</span>
                    <span className="text-sm font-semibold">
                      {hasAnyPrice
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalPreview)
                        : 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label htmlFor="dd-notes">Notes (optional)</Label>
                  <textarea
                    id="dd-notes"
                    {...register('notes')}
                    placeholder="Additional notes…"
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Right Sidebar — activity log placeholder */}
              <div className="w-64 shrink-0 border-l bg-muted/30 px-4 py-4 overflow-y-auto hidden lg:block">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Activity
                </p>
                <p className="text-sm text-muted-foreground italic">
                  Activity log coming soon
                </p>
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

      {/* Confirmation when trying to remove the last line item */}
      <AlertDialog
        open={deleteLineItemIndex !== null}
        onOpenChange={(open) => { if (!open) setDeleteLineItemIndex(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove last line item?</AlertDialogTitle>
            <AlertDialogDescription>
              This bid will have no line items. You can add a new one after saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteLineItemIndex !== null) {
                  remove(deleteLineItemIndex)
                  append({ id: undefined, client: '', scope: undefined as any, price: '' })
                  setDeleteLineItemIndex(null)
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
