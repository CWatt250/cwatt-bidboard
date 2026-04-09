'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { useBid } from '@/hooks/useBid'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import {
  STATUS_BADGE_CLASSES,
  SCOPE_BADGE_CLASSES,
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
import { SmartDateInput } from '@/components/ui/SmartDateInput'
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

const ALL_STATUSES: BidStatus[] = [
  'Unassigned',
  'Bidding',
  'In Progress',
  'Sent',
  'Awarded',
  'Lost',
]

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
  const [scopeItems, setScopeItems] = useState<{ id?: string; scope: BidScope | ''; price: string }[]>([])
  const [notesOpen, setNotesOpen] = useState(false)

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

  useEffect(() => {
    if (!loading && notFound) {
      router.replace('/dashboard')
    }
  }, [loading, notFound, router])

  useEffect(() => {
    if (!bid) return

    const regularItems = (bid.line_items ?? []).filter((li) => li.client)
    const scopeOnlyItems = (bid.line_items ?? []).filter((li) => !li.client)

    setScopeItems(
      scopeOnlyItems.map((li) => ({
        id: li.id,
        scope: li.scope,
        price: li.price?.toString() ?? '',
      }))
    )

    reset({
      project_name: bid.project_name,
      branch: bid.branch,
      estimator_id: bid.estimator_id ?? undefined,
      bid_due_date: bid.bid_due_date,
      project_start_date: bid.project_start_date ?? '',
      line_items:
        regularItems.length > 0
          ? regularItems.map((li) => ({
              id: li.id,
              client: li.client!,
              scope: li.scope,
              price: li.price?.toString() ?? '',
            }))
          : [{ id: undefined, client: '', scope: undefined as any, price: '' }],
    })
  }, [bid, reset])

  const watchedItems = watch('line_items') ?? []

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function onSubmit(values: BidFormData) {
    if (!bid) return
    setSaving(true)
    const supabase = createClient()

    const prevEstimatorId = bid.estimator_id

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

    const formIds = new Set(values.line_items.map((li) => li.id).filter(Boolean))
    const deletedLineItems = (bid.line_items ?? []).filter((li) => li.client && !formIds.has(li.id))

    if (deletedLineItems.length > 0) {
      await supabase
        .from('bid_line_items')
        .delete()
        .in('id', deletedLineItems.map((li) => li.id))

      if (profile) {
        await Promise.all(
          deletedLineItems.map((li) =>
            logActivity(bidId, profile.id, `Removed ${li.scope} line item for ${li.client}`)
          )
        )
      }
    }

    if (profile) {
      const newItems = values.line_items.filter((li) => !li.id)
      await Promise.all(
        newItems.map((li) =>
          logActivity(bidId, profile.id, `Added ${li.scope} line item for ${li.client}`)
        )
      )
    }

    if (profile && values.estimator_id !== prevEstimatorId) {
      const newProfile = profiles.find((p) => p.id === values.estimator_id)
      const newName = newProfile?.name ?? 'Unknown'
      const action = prevEstimatorId
        ? `Reassigned to ${newName}`
        : `Assigned to ${newName}`
      await logActivity(bidId, profile.id, action)
    }

    const validScopeItems = scopeItems.filter((si) => si.scope)
    if (validScopeItems.length > 0) {
      const scopeUpsert = validScopeItems.map((si) => ({
        ...(si.id ? { id: si.id } : {}),
        bid_id: bidId,
        client: null as null,
        scope: si.scope as BidScope,
        price: si.price.trim() ? parseFloat(si.price) : null,
      }))
      await supabase.from('bid_line_items').upsert(scopeUpsert as any, { onConflict: 'id' })
    }

    const keptScopeIds = new Set(scopeItems.map((si) => si.id).filter(Boolean))
    const deletedScopeItems = (bid.line_items ?? []).filter(
      (li) => !li.client && !keptScopeIds.has(li.id)
    )
    if (deletedScopeItems.length > 0) {
      await supabase
        .from('bid_line_items')
        .delete()
        .in('id', deletedScopeItems.map((li) => li.id))
    }

    setSaving(false)
    toast.success('Bid saved successfully.')
    refetch()
  }

  async function handleStatusChange(newStatus: BidStatus) {
    if (!bid || !profile || newStatus === bid.status) return
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

    await logActivity(bidId, profile.id, `Status changed from ${prevStatus} to ${newStatus}`)
    setChangingStatus(null)
    toast.success(`Status updated to ${newStatus}.`)
    refetch()
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

    await logActivity(bidId, profile.id, 'Added a note')
    setNoteText('')
    setAddingNote(false)
    refetch()
  }

  // ─── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl pb-20">
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!bid) return null

  // ─── Derived Values ───────────────────────────────────────────────────────

  const days = daysUntilDue(bid.bid_due_date)

  const scopeTotal = scopeItems.reduce((sum, s) => {
    const p = parseFloat(s.price)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  const clientLineItems = (bid.line_items ?? []).filter((li) => li.client)
  const uniqueClientCount = new Set(clientLineItems.map((li) => li.client)).size
  const totalLineItems = (bid.line_items ?? []).length

  const clientRunningTotal = watchedItems.reduce((sum, item) => {
    const p = parseFloat(item.price ?? '')
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  const displayStatus = changingStatus ?? bid.status

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl space-y-5 pb-20">

      {/* ── Task 1: Header ─────────────────────────────────────────────────── */}

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left side */}
        <div className="flex-1 min-w-0 space-y-1">
          <h1
            className="text-2xl font-extrabold tracking-tight leading-tight"
            style={{ color: 'var(--text)' }}
          >
            {bid.project_name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>
            Branch: {bid.branch} · Estimator: {bid.estimator_name ?? 'Unassigned'}
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--accent2)' }}>
            Due: {formatDate(bid.bid_due_date)}
          </p>
        </div>

        {/* Right side: status badge + change status dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge
            className={`${STATUS_BADGE_CLASSES[bid.status]} rounded-full px-3 py-1 text-xs font-semibold`}
            variant="outline"
          >
            {displayStatus}
          </Badge>
          <Select
            value={bid.status}
            onValueChange={(v) => handleStatusChange(v as BidStatus)}
            disabled={changingStatus !== null}
          >
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${STATUS_BADGE_CLASSES[s].split(' ')[0]}`}
                    />
                    {s}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Task 2: KPI Bar ─────────────────────────────────────────────────── */}

      <div className="grid grid-cols-4 gap-4">
        {/* KPI: Total Bid Value — sum of scope-only line items */}
        <Card className="overflow-hidden">
          <CardContent className="py-4">
            <p
              className="text-xs font-medium uppercase tracking-wide truncate"
              style={{ color: 'var(--text3)' }}
            >
              Total Bid Value
            </p>
            <p
              className="text-xl font-bold mt-1 tabular-nums truncate"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--accent2)',
              }}
            >
              {scopeTotal > 0 ? formatCurrency(scopeTotal) : 'TBD'}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Line Items — total count including scope-only items */}
        <Card className="overflow-hidden">
          <CardContent className="py-4">
            <p
              className="text-xs font-medium uppercase tracking-wide truncate"
              style={{ color: 'var(--text3)' }}
            >
              Line Items
            </p>
            <p
              className="text-xl font-bold mt-1 tabular-nums"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--text)',
              }}
            >
              {totalLineItems}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Clients — unique clients with line items */}
        <Card className="overflow-hidden">
          <CardContent className="py-4">
            <p
              className="text-xs font-medium uppercase tracking-wide truncate"
              style={{ color: 'var(--text3)' }}
            >
              Clients
            </p>
            <p
              className="text-xl font-bold mt-1 tabular-nums"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--text)',
              }}
            >
              {uniqueClientCount}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Due In — green >7d, amber ≤7d, red ≤3d or overdue */}
        <Card className="overflow-hidden">
          <CardContent className="py-4">
            <p
              className="text-xs font-medium uppercase tracking-wide truncate"
              style={{ color: 'var(--text3)' }}
            >
              Due In
            </p>
            <p
              className="text-xl font-bold mt-1 tabular-nums truncate"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color:
                  days <= 3
                    ? 'var(--red, #dc2626)'
                    : days <= 7
                    ? 'var(--yellow, #d97706)'
                    : 'var(--green, #16a34a)',
              }}
            >
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tasks 3 & 4: Scope Breakdown + Client Bids ──────────────────────── */}

      <form id="bid-detail-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-6">

          {/* ── Task 3: Scope Breakdown ── */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Scope Breakdown</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Source of truth for scope pricing
                    {scopeItems.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground/60">
                        · {scopeItems.length} scope{scopeItems.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_36px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <span>Scope</span>
                  <span>Price</span>
                  <span />
                </div>

                {scopeItems.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                    No scopes added yet.
                  </div>
                )}

                {scopeItems.map((item, idx) => (
                  <div
                    key={item.id ?? `new-scope-${idx}`}
                    className="grid grid-cols-[1fr_140px_36px] gap-2 px-3 py-2 items-center border-b last:border-b-0"
                  >
                    <Select
                      value={item.scope}
                      onValueChange={(v) =>
                        setScopeItems((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, scope: v as BidScope } : s))
                        )
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="Select scope" />
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

                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="TBD"
                      value={item.price}
                      onChange={(e) =>
                        setScopeItems((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, price: e.target.value } : s))
                        )
                      }
                      className="h-7 text-xs px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setScopeItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remove scope"
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
                onClick={() => setScopeItems((prev) => [...prev, { scope: '', price: '' }])}
              >
                <PlusIcon className="size-3.5" />
                Add Scope
              </Button>

              {/* Running Total */}
              <div
                className="flex items-center justify-end pt-2"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="text-xs mr-2" style={{ color: 'var(--text3)' }}>
                  Running Total:
                </span>
                <span
                  className="font-bold text-sm tabular-nums"
                  style={{
                    fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                    color: 'var(--accent2)',
                  }}
                >
                  {scopeTotal > 0 ? formatCurrency(scopeTotal) : 'TBD'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Task 4: Client Bids ── */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Client Bids</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Which clients are getting which scopes
                    {uniqueClientCount > 0 && (
                      <span className="ml-1.5 text-muted-foreground/60">
                        · {uniqueClientCount} client{uniqueClientCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {errors.line_items?.root && (
                <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
              )}

              {/* Grouped client summary (read from saved bid data) */}
              {clientLineItems.length > 0 && (
                <div className="border rounded-md overflow-hidden mb-1">
                  <div className="grid grid-cols-[1fr_2fr_100px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                    <span>Client</span>
                    <span>Scopes Included</span>
                    <span className="text-right">Total Bid</span>
                  </div>
                  {Object.entries(
                    clientLineItems.reduce<Record<string, typeof clientLineItems>>(
                      (acc, li) => {
                        const key = li.client!
                        if (!acc[key]) acc[key] = []
                        acc[key].push(li)
                        return acc
                      },
                      {}
                    )
                  ).map(([client, items]) => {
                    const clientTotal = items.reduce((s, li) => s + (li.price ?? 0), 0)
                    return (
                      <div
                        key={client}
                        className="grid grid-cols-[1fr_2fr_100px] gap-2 px-3 py-2 items-center border-b last:border-b-0"
                      >
                        <span className="text-sm font-medium truncate">{client}</span>
                        <div className="flex flex-wrap gap-1">
                          {items.map((li) => (
                            <span
                              key={li.id}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${SCOPE_BADGE_CLASSES[li.scope]}`}
                            >
                              {li.scope}
                            </span>
                          ))}
                        </div>
                        <span
                          className="text-right text-sm font-semibold tabular-nums"
                          style={{
                            fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                          }}
                        >
                          {clientTotal > 0 ? formatCurrency(clientTotal) : 'TBD'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <span>Client</span>
                  <span>Scope</span>
                  <span>Price</span>
                  <span />
                </div>

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
                      className="h-7 text-xs px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                      aria-label="Remove client bid"
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
                Add Client
              </Button>

              {/* Running Total */}
              <div
                className="flex items-center justify-end pt-2"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="text-xs mr-2" style={{ color: 'var(--text3)' }}>
                  Running Total:
                </span>
                <span
                  className="font-bold text-sm tabular-nums"
                  style={{
                    fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                    color: 'var(--accent2)',
                  }}
                >
                  {clientRunningTotal > 0 ? formatCurrency(clientRunningTotal) : 'TBD'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bid Information (project metadata) */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bid Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
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
                </div>

                <div className="space-y-4">
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
                        render={({ field }) => {
                          const displayName = (() => {
                            if (!field.value) return null
                            return (
                              estimatorProfiles.find((p) => p.id === field.value)?.name ??
                              profiles.find((p) => p.id === field.value)?.name ??
                              null
                            )
                          })()
                          return (
                            <Select
                              value={field.value ?? '__none__'}
                              onValueChange={(v) =>
                                field.onChange(v === '__none__' ? null : v)
                              }
                            >
                              <SelectTrigger className="w-full">
                                {displayName ? (
                                  <span>{displayName}</span>
                                ) : (
                                  <span className="italic text-muted-foreground">
                                    Unassigned
                                  </span>
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <span className="italic text-muted-foreground">
                                    Unassigned
                                  </span>
                                </SelectItem>
                                {estimatorProfiles.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        }}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bd-bid_due_date">Bid Due Date</Label>
                      <Controller
                        name="bid_due_date"
                        control={control}
                        render={({ field }) => (
                          <SmartDateInput
                            id="bd-bid_due_date"
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
                      <Label htmlFor="bd-project_start_date">Project Start (optional)</Label>
                      <Controller
                        name="project_start_date"
                        control={control}
                        render={({ field }) => (
                          <SmartDateInput
                            id="bd-project_start_date"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* ── Task 5: Notes (collapsible, collapsed by default) ────────────────── */}

      <Card>
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setNotesOpen((o) => !o)}
        >
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer select-none py-4">
            <CardTitle>Notes</CardTitle>
            {notesOpen ? (
              <ChevronUpIcon className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            )}
          </CardHeader>
        </button>

        {notesOpen && (
          <CardContent className="space-y-3 pt-0">
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

            {notes.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text3)' }}>
                No notes yet.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="pb-2.5 mb-2.5 border-b last:border-b-0 last:mb-0 last:pb-0"
                  >
                    <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
                      {note.text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      {note.author_name ?? 'Unknown'} · {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      {/* Activity — only rendered when entries exist */}
      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-72 overflow-y-auto">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex gap-2.5 pb-3 mb-0 border-b last:border-b-0 last:pb-0"
                >
                  <div
                    className="size-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: 'var(--accent)' }}
                  />
                  <div>
                    <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
                      {entry.action}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      {entry.author_name ?? 'System'} · {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Task 5: Bottom Summary Bar ───────────────────────────────────────── */}

      <div
        className="fixed bottom-0 left-60 right-0 z-10 border-t px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--surface, var(--background))',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
            Total Bid Value
          </span>
          <span
            className="text-2xl font-bold tabular-nums"
            style={{
              fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
              color: 'var(--accent2)',
            }}
          >
            {scopeTotal > 0 ? formatCurrency(scopeTotal) : 'TBD'}
          </span>
        </div>
        <Button
          type="submit"
          form="bid-detail-form"
          disabled={saving}
          size="lg"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

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
