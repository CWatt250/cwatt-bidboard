'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  PlusIcon,
  XIcon,
  ChevronRightIcon,
  MapPinIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { ensureClientId } from '@/lib/clients'
import { useBid } from '@/hooks/useBid'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { SCOPE_BADGE_CLASSES } from '@/config/colors'
import { ScopeEditor } from '@/components/spreadsheet/ScopeEditor'
import { InlinePriceCell } from '@/components/bids/InlinePriceCell'
import { InlineAwardedCell } from '@/components/bids/InlineAwardedCell'
import { InlineScopeEstimatorCell } from '@/components/bids/InlineScopeEstimatorCell'
import { ProminentStatusCell } from '@/components/bids/ProminentStatusCell'
import { DocumentsSection } from '@/components/bids/DocumentsSection'
import type { BidStatus, Branch, BidScope } from '@/lib/supabase/types'
import { BRANCH_LABELS, getBidClientName } from '@/lib/supabase/types'
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

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

/** Statuses where the bid is still being worked — Due In should count down here. */
const ACTIVE_STATUSES: ReadonlySet<BidStatus> = new Set<BidStatus>([
  'Unassigned',
  'Bidding',
  'In Progress',
])

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const bidFormSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  project_location: z.string().optional(),
  mike_estimate_number: z.string().optional(),
  branch: z.enum(['PSC', 'SEA', 'POR', 'PHX', 'SLC'] as const),
  estimator_id: z.string().nullable().optional(),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
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
  const { bid, activity, loading, notFound, refetch } = useBid(bidId)
  const { profiles } = useBidDetail()
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile } = useUserRole()

  const [saving, setSaving] = useState(false)
  // Client rows mirror bid.bid_clients (id, name, selected scopes). Each row's
  // scope toggles persist to bid_clients.scopes immediately — they don't wait
  // for the Save Changes button.
  const [clientRows, setClientRows] = useState<
    Array<{ id: string; name: string; scopes: string[] }>
  >([])
  const [allClients, setAllClients] = useState<string[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)

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
    formState: { errors },
  } = useForm<BidFormData>({
    resolver: zodResolver(bidFormSchema),
  })

  useEffect(() => {
    if (!loading && notFound) {
      router.replace('/dashboard')
    }
  }, [loading, notFound, router])

  useEffect(() => {
    if (!bid) return

    reset({
      project_name: bid.project_name,
      project_location: bid.project_location ?? '',
      mike_estimate_number: bid.mike_estimate_number ?? '',
      branch: bid.branch,
      estimator_id: bid.estimator_id ?? profile?.id ?? undefined,
      bid_due_date: bid.bid_due_date,
    })

    setClientRows(
      (bid.clients ?? [])
        .map((c) => ({
          id: c.id,
          name: getBidClientName(c),
          scopes: c.scopes ?? [],
        }))
        .filter((r) => r.name),
    )
  }, [bid, reset])

  // Fetch master clients list once for the Add Client dropdown.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('clients')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setAllClients(
          ((data ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean)
        )
      })
  }, [])

  // When a scope is removed from the bid entirely (Scope Pricing card), purge
  // it from every client's scopes array. Detected after each bid refetch.
  useEffect(() => {
    if (!bid?.clients) return
    const currentScopes = new Set(
      (bid.line_items ?? []).filter((li) => !li.client).map((li) => li.scope as string),
    )
    const stale = bid.clients.filter(
      (c) => (c.scopes ?? []).some((s) => !currentScopes.has(s)),
    )
    if (stale.length === 0) return
    const supabase = createClient()
    Promise.all(
      stale.map((c) =>
        supabase
          .from('bid_clients')
          .update({
            scopes: (c.scopes ?? []).filter((s) => currentScopes.has(s)),
          })
          .eq('id', c.id),
      ),
    ).then(() => refetch())
  }, [bid, refetch])

  // Distinct scopes available on this bid (sourced from scope-only line items).
  function getBidScopes(): BidScope[] {
    const items = (bid?.line_items ?? []).filter((li) => !li.client)
    return Array.from(new Set(items.map((li) => li.scope))) as BidScope[]
  }

  async function addClient(name: string) {
    const trimmed = name.trim()
    if (!trimmed || addingClient) return
    if (clientRows.some((r) => r.name === trimmed)) return

    setAddingClient(true)
    const supabase = createClient()
    const client_id = await ensureClientId(supabase, trimmed)

    // Default new clients to all current bid scopes (matches migration backfill
    // behavior — user can deselect any that don't apply).
    const defaultScopes = getBidScopes()

    const { error } = await supabase
      .from('bid_clients')
      .insert({ bid_id: bidId, client_id, client_name: trimmed, scopes: defaultScopes })

    if (error) {
      setAddingClient(false)
      toast.error('Failed to add client.')
      return
    }

    setAllClients((prev) =>
      prev.includes(trimmed)
        ? prev
        : [...prev, trimmed].sort((a, b) => a.localeCompare(b)),
    )
    if (profile) {
      await logActivity(bidId, profile.id, `Added client ${trimmed}`)
    }
    setAddingClient(false)
    refetch()
  }

  async function removeClient(rowId: string, name: string) {
    const supabase = createClient()
    setClientRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error } = await supabase.from('bid_clients').delete().eq('id', rowId)
    if (error) {
      toast.error('Failed to remove client.')
      refetch()
      return
    }
    if (profile) {
      await logActivity(bidId, profile.id, `Removed client ${name}`)
    }
    refetch()
  }

  async function toggleClientScope(rowId: string, scope: string) {
    const row = clientRows.find((r) => r.id === rowId)
    if (!row) return
    const next = row.scopes.includes(scope)
      ? row.scopes.filter((s) => s !== scope)
      : [...row.scopes, scope]

    setClientRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, scopes: next } : r)),
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('bid_clients')
      .update({ scopes: next })
      .eq('id', rowId)
    if (error) {
      toast.error('Failed to update client scopes.')
      refetch()
    }
  }

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
        project_location: values.project_location?.trim() ? values.project_location.trim() : null,
        mike_estimate_number: values.mike_estimate_number?.trim() ? values.mike_estimate_number.trim() : null,
        branch: values.branch,
        estimator_id: values.estimator_id ?? null,
        bid_due_date: values.bid_due_date,
      })
      .eq('id', bidId)

    if (bidError) {
      setSaving(false)
      toast.error('Failed to save changes. Please try again.')
      return
    }

    if (profile && values.estimator_id !== prevEstimatorId) {
      const newProfile = profiles.find((p) => p.id === values.estimator_id)
      const newName = newProfile?.name ?? 'Unknown'
      const action = prevEstimatorId
        ? `Reassigned to ${newName}`
        : `Assigned to ${newName}`
      await logActivity(bidId, profile.id, action)
    }

    setSaving(false)
    toast.success('Bid saved successfully.')
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

  const scopeOnlyItems = (bid.line_items ?? []).filter((li) => !li.client)
  const scopeTotal = scopeOnlyItems.reduce((s, li) => s + (li.price ?? 0), 0)
  const bidScopes = Array.from(new Set(scopeOnlyItems.map((li) => li.scope))) as BidScope[]
  const priceByScope = new Map<string, number>(
    scopeOnlyItems.map((li) => [li.scope as string, li.price ?? 0]),
  )

  function perClientTotal(scopes: string[]): number {
    return scopes.reduce((s, scope) => s + (priceByScope.get(scope) ?? 0), 0)
  }

  const uniqueClientCount = clientRows.length
  const totalLineItems = (bid.line_items ?? []).length

  const clientNamesSet = new Set(clientRows.map((r) => r.name))
  const availableClientOptions = allClients.filter((c) => !clientNamesSet.has(c))

  const isClosed = !ACTIVE_STATUSES.has(bid.status)
  // Due In styling: when closed, neutral; otherwise red ≤3d, amber ≤7d, green >7d.
  const dueInColor = isClosed
    ? 'var(--text3)'
    : days <= 3
    ? 'var(--red)'
    : days <= 7
    ? 'var(--yellow)'
    : 'var(--green)'
  const dueInLabel = isClosed
    ? 'Submitted'
    : days < 0
    ? `${Math.abs(days)}d overdue`
    : `${days}d`

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl space-y-5 pb-20 bg-[var(--bg)]">

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

      {/* Page Header — status now lives in the KPI row as a prominent card. */}
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
        {(bid.project_location || bid.mike_estimate_number) && (
          <p className="text-sm" style={{ color: 'var(--text3)' }}>
            {bid.project_location && (
              <span>
                <MapPinIcon className="inline-block size-3.5 -mt-0.5 mr-1" />
                {bid.project_location}
              </span>
            )}
            {bid.project_location && bid.mike_estimate_number && (
              <span style={{ margin: '0 8px', color: 'var(--text3)' }}>·</span>
            )}
            {bid.mike_estimate_number && (
              <span style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}>
                MIKE #{bid.mike_estimate_number}
              </span>
            )}
          </p>
        )}
        <p className="text-sm font-medium" style={{ color: 'var(--accent2)' }}>
          Due: {formatDate(bid.bid_due_date)}
        </p>
      </div>

      {/* ── Task 2: KPI Bar ─────────────────────────────────────────────────── */}

      <div className="grid grid-cols-5 gap-4">
        {/* KPI: Status — prominent, clickable */}
        <Card className="overflow-hidden shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardContent className="py-5 px-5">
            <p className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--text3)' }}>
              Status
            </p>
            <div className="mt-1.5">
              <ProminentStatusCell
                bidId={bid.id}
                userId={profile?.id ?? null}
                initialStatus={bid.status}
                onChanged={refetch}
              />
            </div>
          </CardContent>
        </Card>

        {/* KPI: Total Bid Value — sum of scope-only line items */}
        <Card className="overflow-hidden shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardContent className="py-5 px-5">
            <p className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--text3)' }}>
              Total Bid Value
            </p>
            <p
              className="text-[28px] font-bold mt-1.5 tabular-nums truncate leading-none"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--accent2)',
              }}
            >
              {scopeTotal > 0 ? formatCurrency(scopeTotal) : '—'}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Line Items — total count including scope-only items */}
        <Card className="overflow-hidden shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardContent className="py-5 px-5">
            <p className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--text3)' }}>
              Line Items
            </p>
            <p
              className="text-[28px] font-bold mt-1.5 tabular-nums leading-none"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--text)',
              }}
            >
              {totalLineItems}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Clients — unique clients on this bid */}
        <Card className="overflow-hidden shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardContent className="py-5 px-5">
            <p className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--text3)' }}>
              Clients
            </p>
            <p
              className="text-[28px] font-bold mt-1.5 tabular-nums leading-none"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: 'var(--text)',
              }}
            >
              {uniqueClientCount}
            </p>
          </CardContent>
        </Card>

        {/* KPI: Due In — neutral "Submitted" for closed bids, otherwise countdown. */}
        <Card className="overflow-hidden shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardContent className="py-5 px-5">
            <p className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--text3)' }}>
              Due In
            </p>
            <p
              className="text-[28px] font-bold mt-1.5 tabular-nums truncate leading-none"
              style={{
                fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                color: dueInColor,
              }}
            >
              {dueInLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tasks 3 & 4: Scope Breakdown + Client Bids ──────────────────────── */}

      <form id="bid-detail-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-6">

          {/* ── Task 3: Scope Pricing ── */}
          <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="font-bold text-[var(--text)]">Scope Pricing</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Source of truth for scope pricing
                    {scopeOnlyItems.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground/60">
                        · {scopeOnlyItems.length} scope{scopeOnlyItems.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {scopeOnlyItems.length > 0 && (
                  <ScopeEditor
                    bid={bid}
                    trigger={
                      <Button variant="outline" size="sm" type="button">
                        <PlusIcon className="size-3.5 mr-1" />
                        Add Scope
                      </Button>
                    }
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-[32px_1fr_150px_110px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <span className="text-center" title="Awarded">Won</span>
                  <span>Scope</span>
                  <span>Estimator</span>
                  <span className="text-right">Price</span>
                </div>
                {scopeOnlyItems.length === 0 ? (
                  <ScopeEditor
                    bid={bid}
                    triggerClassName="block w-full text-left cursor-pointer hover:bg-muted/30 transition-colors"
                    trigger={
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                        Click to add scope pricing.
                      </div>
                    }
                  />
                ) : (
                  scopeOnlyItems.map((li) => (
                    <div
                      key={li.id}
                      className="grid grid-cols-[32px_1fr_150px_110px] gap-2 px-3 py-2 items-center border-b"
                      style={{
                        borderLeft: li.is_awarded ? '3px solid var(--green, #16a34a)' : '3px solid transparent',
                        background: li.is_awarded ? 'rgba(22,163,74,0.04)' : undefined,
                      }}
                    >
                      <InlineAwardedCell
                        lineItemId={li.id}
                        bidId={bidId}
                        bidStatus={bid.status}
                        userId={profile?.id ?? null}
                        scope={li.scope}
                        initialIsAwarded={li.is_awarded}
                      />
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs w-fit ${SCOPE_BADGE_CLASSES[li.scope]}`}>
                          {li.scope}
                        </span>
                        {li.is_awarded && (
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              background: 'rgba(22,163,74,0.12)',
                              color: 'var(--green, #16a34a)',
                              letterSpacing: '0.05em',
                            }}
                            title="This scope was awarded"
                          >
                            Won
                          </span>
                        )}
                      </span>
                      <InlineScopeEstimatorCell
                        lineItemId={li.id}
                        bidId={bidId}
                        userId={profile?.id ?? null}
                        scope={li.scope}
                        initialEstimatorId={li.estimator_id}
                        leadEstimatorName={bid.estimator_name}
                      />
                      <InlinePriceCell
                        lineItemId={li.id}
                        bidId={bidId}
                        userId={profile?.id ?? null}
                        scope={li.scope}
                        initialPrice={li.price}
                      />
                    </div>
                  ))
                )}
                {scopeOnlyItems.length > 0 && (
                  <div className="grid grid-cols-[32px_1fr_150px_110px] gap-2 bg-muted/40 px-3 py-2 items-center">
                    <span />
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text2)' }}
                    >
                      Total
                    </span>
                    <span />
                    <span
                      className="text-right text-base font-bold tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
                        color: 'var(--accent2)',
                      }}
                    >
                      {formatCurrency(scopeTotal)}
                    </span>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* ── Task 4: Client Bids ── */}
          <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="font-bold text-[var(--text)]">Client Bids</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clients receiving this bid
                    {uniqueClientCount > 0 && (
                      <span className="ml-1.5 text-muted-foreground/60">
                        · {uniqueClientCount} client{uniqueClientCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {/* Per-client rows: name · scope chips · per-client total · remove */}
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_minmax(0,2fr)_120px_32px] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <span>Client</span>
                  <span>Scopes</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {clientRows.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                    No clients added yet.
                  </div>
                ) : (
                  clientRows.map((row) => {
                    const rowTotal = perClientTotal(row.scopes)
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_minmax(0,2fr)_120px_32px] gap-3 px-3 py-2 items-center border-b last:border-b-0"
                      >
                        <span className="text-sm font-medium truncate" title={row.name}>
                          {row.name}
                        </span>

                        {/* Scope chips — toggling persists immediately */}
                        <div className="flex flex-wrap gap-1">
                          {bidScopes.length === 0 ? (
                            <span className="text-xs italic text-muted-foreground">
                              Add scopes first
                            </span>
                          ) : (
                            bidScopes.map((s) => {
                              const selected = row.scopes.includes(s)
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => toggleClientScope(row.id, s)}
                                  aria-pressed={selected}
                                  aria-label={`Toggle ${s} for ${row.name}`}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-opacity ${
                                    SCOPE_BADGE_CLASSES[s]
                                  } ${selected ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                >
                                  {s}
                                </button>
                              )
                            })
                          )}
                        </div>

                        <span
                          className="text-right text-sm font-bold tabular-nums"
                          style={{
                            fontFamily:
                              'var(--font-mono), "IBM Plex Mono", monospace',
                            color: 'var(--accent2)',
                          }}
                        >
                          {rowTotal > 0 ? formatCurrency(rowTotal) : '—'}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeClient(row.id, row.name)}
                          aria-label={`Remove client ${row.name}`}
                        >
                          <XIcon className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Add Client — dropdown sourced from clients master table */}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text3)' }}>
                  Add Client
                </p>
                <Select
                  value=""
                  onValueChange={(v) => { if (v) addClient(v) }}
                  disabled={availableClientOptions.length === 0 || addingClient}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue
                      placeholder={
                        availableClientOptions.length === 0
                          ? 'All available clients added'
                          : 'Pick from existing clients…'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClientOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="…or type a new client name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = newClientName
                        setNewClientName('')
                        addClient(v)
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!newClientName.trim() || addingClient}
                    onClick={() => {
                      const v = newClientName
                      setNewClientName('')
                      addClient(v)
                    }}
                  >
                    <PlusIcon className="size-3.5" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  New clients default to all current bid scopes — deselect any that
                  don't apply. Changes save instantly.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bid Information (project metadata) */}
        <div className="mt-6">
          <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
            <CardHeader>
              <CardTitle className="font-bold text-[var(--text)]">Bid Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Project Info group */}
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-3" style={{ color: 'var(--text3)' }}>
                  Project Info
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="bd-project_name" className="text-sm" style={{ color: 'var(--text3)' }}>
                      Project Name
                    </Label>
                    <Input
                      id="bd-project_name"
                      {...register('project_name')}
                      className="border-[var(--border)]"
                    />
                    {errors.project_name && (
                      <p className="text-xs text-destructive">{errors.project_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: 'var(--text3)' }}>Branch</Label>
                    <Controller
                      name="branch"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full border-[var(--border)]">
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

                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: 'var(--text3)' }}>Estimator</Label>
                    {isEstimator ? (
                      <div className="h-9 px-3 flex items-center rounded-md border border-[var(--border)] bg-muted/40 text-sm" style={{ color: 'var(--text)' }}>
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
                              <SelectTrigger className="w-full border-[var(--border)]">
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
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-1">
                    <Label htmlFor="bd-project_location" className="text-sm" style={{ color: 'var(--text3)' }}>
                      Project Location
                    </Label>
                    <Input
                      id="bd-project_location"
                      {...register('project_location')}
                      placeholder="City, State or full address"
                      className="border-[var(--border)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bd-mike_estimate_number" className="text-sm" style={{ color: 'var(--text3)' }}>
                      MIKE Estimate #
                    </Label>
                    <Input
                      id="bd-mike_estimate_number"
                      {...register('mike_estimate_number')}
                      placeholder="e.g. 181656"
                      className="border-[var(--border)]"
                    />
                  </div>
                </div>
              </div>

              {/* Dates group */}
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-3" style={{ color: 'var(--text3)' }}>
                  Dates
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="bd-bid_due_date" className="text-sm" style={{ color: 'var(--text3)' }}>
                      Bid Due Date
                    </Label>
                    <Controller
                      name="bid_due_date"
                      control={control}
                      render={({ field }) => (
                        <SmartDateInput
                          id="bd-bid_due_date"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          className="flex h-9 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      )}
                    />
                    {errors.bid_due_date && (
                      <p className="text-xs text-destructive">{errors.bid_due_date.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Documents */}
      <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
        <CardHeader>
          <CardTitle className="font-bold text-[var(--text)]">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsSection bidId={bid.id} />
        </CardContent>
      </Card>

      {/* Activity — only rendered when entries exist */}
      {activity.length > 0 && (
        <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="font-bold text-[var(--text)]">Activity</CardTitle>
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
        className="fixed bottom-0 left-60 right-0 z-10 border-t px-6 py-3 flex items-center justify-between backdrop-blur-sm"
        style={{
          background: 'color-mix(in srgb, var(--background, #fff) 90%, transparent)',
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

    </div>
  )
}
