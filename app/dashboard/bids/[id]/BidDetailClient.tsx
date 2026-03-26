'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBid } from '@/hooks/useBid'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import {
  STATUS_BADGE_CLASSES,
  SCOPE_BADGE_CLASSES,
  BRANCH_BADGE_CLASSES,
  DUE_DATE_URGENT_CLASS,
  DUE_DATE_WARNING_CLASS,
} from '@/config/colors'
import type { BidStatus, BidScope, Branch } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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

const SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]

const BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

const STATUS_TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  Unassigned: ['Bidding'],
  Bidding: ['In Progress', 'Sent', 'Lost'],
  'In Progress': ['Sent', 'Lost'],
  Sent: ['Awarded', 'Lost'],
  Awarded: [],
  Lost: [],
}

const STATUS_TRANSITION_LABELS: Record<BidStatus, string> = {
  Unassigned: '→ Start Bidding',
  Bidding: '→ In Progress',
  'In Progress': '→ In Progress',
  Sent: '→ Awarded',
  Awarded: '',
  Lost: '→ Lost',
}

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  id: z.string().optional(),
  client: z.string().min(1, 'Required'),
  scope: z.enum([
    'Plumbing Piping',
    'HVAC Piping',
    'HVAC Ductwork',
    'Fire Stopping',
    'Equipment',
    'Other',
  ] as const),
  price: z.string().optional(),
})

const bidFormSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  branch: z.enum(['PSC', 'SEA', 'POR', 'PHX', 'SLC'] as const),
  estimator_id: z.string().nullable().optional(),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
  project_start_date: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type BidFormData = z.infer<typeof bidFormSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function daysUntilDue(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function dueDateClass(days: number): string {
  if (days <= 3) return DUE_DATE_URGENT_CLASS
  if (days <= 7) return DUE_DATE_WARNING_CLASS
  return ''
}

// ─── BidDetailClient ──────────────────────────────────────────────────────────

export default function BidDetailClient({ bidId }: { bidId: string }) {
  const router = useRouter()
  const { bid, activity, notes, loading, notFound, refetch } = useBid(bidId)
  const { profiles } = useBidDetail()
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile } = useUserRole()

  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState<BidStatus | null>(null)
  const [deleteLineItemIndex, setDeleteLineItemIndex] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Estimator dropdown options based on role
  const estimatorProfiles = (() => {
    if (isAdmin) return profiles
    if (isBranchManager) {
      return profiles.filter((p) =>
        (p.branches ?? []).some((b) => userBranches.includes(b as Branch))
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
  } = useForm<BidFormData>({
    resolver: zodResolver(bidFormSchema),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  // Redirect if bid not found or unauthorized
  useEffect(() => {
    if (!loading && notFound) {
      router.replace('/dashboard')
    }
  }, [loading, notFound, router])

  // Populate form when bid loads
  useEffect(() => {
    if (!bid) return
    reset({
      project_name: bid.project_name,
      branch: bid.branch,
      estimator_id: bid.estimator_id ?? undefined,
      bid_due_date: bid.bid_due_date,
      project_start_date: bid.project_start_date ?? '',
      line_items:
        (bid.line_items ?? []).length > 0
          ? (bid.line_items ?? []).map((li) => ({
              id: li.id,
              client: li.client,
              scope: li.scope,
              price: li.price?.toString() ?? '',
            }))
          : [{ id: undefined, client: '', scope: undefined as any, price: '' }],
    })
  }, [bid, reset])

  const watchedItems = watch('line_items') ?? []
  const totalPreview = watchedItems.reduce((sum, item) => {
    const p = parseFloat(item.price ?? '')
    return sum + (isNaN(p) ? 0 : p)
  }, 0)
  const hasAnyPrice = watchedItems.some((item) => !isNaN(parseFloat(item.price ?? '')))

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function onSubmit(values: BidFormData) {
    if (!bid) return
    setSaving(true)
    const supabase = createClient()

    const prevEstimatorId = bid.estimator_id
    const prevEstimatorName = bid.estimator_name

    const { error: bidError } = await supabase
      .from('bids')
      .update({
        project_name: values.project_name,
        branch: values.branch,
        estimator_id: values.estimator_id ?? null,
        bid_due_date: values.bid_due_date,
        project_start_date: values.project_start_date?.trim() || null,
      })
      .eq('id', bidId)

    if (bidError) {
      setSaving(false)
      toast.error('Failed to save changes. Please try again.')
      return
    }

    // Upsert line items
    const lineItemsToUpsert = values.line_items.map((li) => ({
      ...(li.id ? { id: li.id } : {}),
      bid_id: bidId,
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

    // Delete line items that were removed
    const formIds = new Set(values.line_items.map((li) => li.id).filter(Boolean))
    const deletedIds = (bid.line_items ?? [])
      .map((li) => li.id)
      .filter((id) => !formIds.has(id))

    if (deletedIds.length > 0) {
      await supabase.from('bid_line_items').delete().in('id', deletedIds)
    }

    // Log estimator change if applicable (silently; table may not exist yet)
    if (profile && values.estimator_id !== prevEstimatorId) {
      const newProfile = profiles.find((p) => p.id === values.estimator_id)
      const newName = newProfile?.name ?? 'Unknown'
      const action = prevEstimatorId
        ? `Reassigned to ${newName}`
        : `Assigned to ${newName}`
      await supabase
        .from('bid_activity')
        .insert({ bid_id: bidId, user_id: profile.id, action })
    }

    setSaving(false)
    toast.success('Bid saved successfully.')
  }

  async function handleStatusChange(newStatus: BidStatus) {
    if (!bid || !profile) return
    setChangingStatus(newStatus)
    const supabase = createClient()
    const prevStatus = bid.status

    const { error } = await supabase
      .from('bids')
      .update({ status: newStatus })
      .eq('id', bidId)

    if (error) {
      setChangingStatus(null)
      toast.error('Failed to update status.')
      return
    }

    // Log status change (silently; table may not exist yet)
    await supabase
      .from('bid_activity')
      .insert({
        bid_id: bidId,
        user_id: profile.id,
        action: `Status changed from ${prevStatus} to ${newStatus}`,
      })

    setChangingStatus(null)
    toast.success(`Status updated to ${newStatus}.`)
  }

  async function handleAddNote() {
    if (!noteText.trim() || !profile) return
    setAddingNote(true)
    const supabase = createClient()

    const { error } = await supabase.from('bid_notes').insert({
      bid_id: bidId,
      user_id: profile.id,
      text: noteText.trim(),
    })

    if (error) {
      setAddingNote(false)
      toast.error('Failed to add note.')
      return
    }

    // Log note added (silently; table may not exist yet)
    await supabase
      .from('bid_activity')
      .insert({ bid_id: bidId, user_id: profile.id, action: 'Added a note' })

    setNoteText('')
    setAddingNote(false)
    refetch()
  }

  // ─── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <Skeleton className="h-4 w-80" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-[5fr_3fr_2fr] gap-6 mt-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!bid) return null

  const days = daysUntilDue(bid.bid_due_date)
  const nextStatuses = STATUS_TRANSITIONS[bid.status] ?? []
  const uniqueClients = new Set((bid.line_items ?? []).map((li) => li.client)).size

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          My Workspace
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="text-foreground font-medium truncate">{bid.project_name}</span>
      </nav>

      {/* Page Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeftIcon className="size-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold leading-tight">{bid.project_name}</h1>
              <Badge
                className={STATUS_BADGE_CLASSES[bid.status]}
                variant="outline"
              >
                {bid.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {formatDateTime(bid.updated_at)}
            </p>
          </div>
        </div>

        {/* Status Change Buttons */}
        {nextStatuses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((next) => (
              <Button
                key={next}
                size="sm"
                variant="outline"
                disabled={changingStatus !== null}
                onClick={() => handleStatusChange(next)}
              >
                {changingStatus === next ? 'Updating…' : `→ ${next}`}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Three Column Layout */}
      <form id="bid-detail-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-[5fr_3fr_2fr] gap-6 items-start">
          {/* ── Left Column ── */}
          <div className="flex flex-col gap-4">
            {/* Bid Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Bid Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project Name */}
                <div className="space-y-1">
                  <Label htmlFor="bd-project_name">Project Name</Label>
                  <Input
                    id="bd-project_name"
                    {...register('project_name')}
                    placeholder="Project name"
                  />
                  {errors.project_name && (
                    <p className="text-xs text-destructive">{errors.project_name.message}</p>
                  )}
                </div>

                {/* Branch */}
                <div className="space-y-1">
                  <Label>Branch</Label>
                  <Controller
                    name="branch"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {(isAdmin
                            ? BRANCHES
                            : BRANCHES.filter((b) => userBranches.includes(b))
                          ).map((b) => (
                            <SelectItem key={b} value={b}>
                              {BRANCH_LABELS[b]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.branch && (
                    <p className="text-xs text-destructive">{errors.branch.message}</p>
                  )}
                </div>

                {/* Estimator */}
                <div className="space-y-1">
                  <Label>Estimator</Label>
                  {isEstimator ? (
                    <div className="h-9 px-3 flex items-center rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                      {bid.estimator_name ?? 'Unassigned'}
                    </div>
                  ) : (
                    <Controller
                      name="estimator_id"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ?? '__none__'}
                          onValueChange={(v) =>
                            field.onChange(v === '__none__' ? null : v)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="italic text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {estimatorProfiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="bd-bid_due_date">Bid Due Date</Label>
                    <Input
                      id="bd-bid_due_date"
                      type="date"
                      {...register('bid_due_date')}
                    />
                    {errors.bid_due_date && (
                      <p className="text-xs text-destructive">{errors.bid_due_date.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bd-project_start_date">Project Start (optional)</Label>
                    <Input
                      id="bd-project_start_date"
                      type="date"
                      {...register('project_start_date')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Card */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {errors.line_items?.root && (
                  <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
                )}

                <div className="border rounded-md overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                    <span>Client</span>
                    <span>Scope</span>
                    <span>Price</span>
                    <span />
                  </div>

                  {/* Table Rows */}
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 px-3 py-2 items-start border-b last:border-b-0"
                    >
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
                            <Select
                              value={scopeField.value}
                              onValueChange={scopeField.onChange}
                            >
                              <SelectTrigger className="w-full h-7 text-xs">
                                <SelectValue placeholder="Scope" />
                              </SelectTrigger>
                              <SelectContent>
                                {SCOPES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    <span
                                      className={`inline-flex items-center rounded px-1 text-xs ${SCOPE_BADGE_CLASSES[s]}`}
                                    >
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
                  onClick={() =>
                    append({ id: undefined, client: '', scope: undefined as any, price: '' })
                  }
                >
                  <PlusIcon className="size-3.5" />
                  Add Line Item
                </Button>

                {/* Running Total */}
                <div className="flex items-center justify-end pt-1 border-t">
                  <span className="text-sm text-muted-foreground mr-2">Total:</span>
                  <span className="text-sm font-semibold">
                    {hasAnyPrice ? formatCurrency(totalPreview) : 'TBD'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-2 pb-4 border-t">
              <Button type="submit" form="bid-detail-form" disabled={saving} size="lg">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* ── Center Column ── */}
          <div className="flex flex-col gap-4">
            {/* Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add Note Input */}
                <div className="flex gap-2">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddNote()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!noteText.trim() || addingNote}
                    onClick={handleAddNote}
                  >
                    {addingNote ? '…' : 'Add'}
                  </Button>
                </div>

                {/* Notes List (newest first) */}
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No notes yet.</p>
                ) : (
                  <ul className="space-y-2.5 max-h-64 overflow-y-auto">
                    {notes.map((note) => (
                      <li key={note.id} className="text-sm border-b pb-2 last:border-b-0">
                        <p className="leading-snug">{note.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.author_name ?? 'Unknown'} · {formatDateTime(note.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Activity Log Card */}
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No activity yet.</p>
                ) : (
                  <ul className="space-y-2.5 max-h-72 overflow-y-auto">
                    {activity.map((entry) => (
                      <li key={entry.id} className="text-sm border-b pb-2 last:border-b-0">
                        <p className="leading-snug">{entry.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.author_name ?? 'System'} · {formatDateTime(entry.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right Column ── */}
          <div className="flex flex-col gap-4">
            {/* Quick Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bid Value</span>
                  <span className="font-semibold">
                    {(bid.total_price ?? 0) > 0 ? formatCurrency(bid.total_price ?? 0) : 'TBD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Items</span>
                  <span className="font-semibold">{bid.line_items?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clients</span>
                  <span className="font-semibold">{uniqueClients}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Days Until Due</span>
                  <span className={`font-semibold ${dueDateClass(days)}`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Bid ID Card */}
            <Card>
              <CardHeader>
                <CardTitle>Bid Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Bid ID</p>
                  <p className="font-mono text-xs break-all">{bid.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p>{formatDate(bid.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Branch</p>
                  <Badge
                    className={BRANCH_BADGE_CLASSES[bid.branch] ?? ''}
                    variant="outline"
                  >
                    {bid.branch}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Confirm remove last line item */}
      <AlertDialog
        open={deleteLineItemIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLineItemIndex(null)
        }}
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
    </div>
  )
}
