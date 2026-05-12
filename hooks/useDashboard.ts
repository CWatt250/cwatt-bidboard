'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import type { Bid, BidLineItem, BidClient, Branch, BidScope } from '@/lib/supabase/types'

export interface DashboardStats {
  activeCount: number
  sentCount: number
  awardedCount: number
  lostCount: number
  pipelineValue: number
  bidsDueThisWeek: Bid[]
  // Admin-only
  sentThisMonth: number
  awardedYTD: number
  totalActiveEstimators: number
}

export interface EstimatorBreakdown {
  id: string
  name: string
  branch: string
  activeBids: number
  sentCount: number
  awardedCount: number
  pipelineValue: number
}

export interface BranchBreakdownItem {
  branch: Branch
  pipelineValue: number
  activeCount: number
  sentCount: number
  awardedCount: number
}

export interface ScopeBreakdownItem {
  scope: BidScope
  count: number
}

export interface UseDashboardResult {
  stats: DashboardStats | null
  recentBids: Bid[]
  allBids: Bid[]
  orgBids: Bid[]
  branchBreakdown: BranchBreakdownItem[]
  estimatorBreakdown: EstimatorBreakdown[]
  scopeBreakdown: ScopeBreakdownItem[]
  loading: boolean
  error: string | null
}

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]

function mapBidRow(row: any): Bid {
  const line_items: BidLineItem[] = (row.bid_line_items ?? []).map((li: any) => ({
    ...li,
    estimator_name: li.estimator?.name ?? null,
  }))
  const clients: BidClient[] = row.bid_clients ?? []
  const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
  return {
    ...row,
    estimator_name: row.profiles?.name ?? null,
    line_items,
    clients,
    total_price,
  }
}

/** Returns true when `userId` either leads `bid` or owns at least one of its line items. */
export function userIsOnBid(bid: Bid, userId: string): boolean {
  if (bid.estimator_id === userId) return true
  return (bid.line_items ?? []).some((li) => li.estimator_id === userId)
}

/** Sum of line-item prices the given user is responsible for on a single bid. */
export function userBidValue(bid: Bid, userId: string): number {
  return (bid.line_items ?? []).reduce((sum, li) => {
    const owner = li.estimator_id ?? bid.estimator_id
    if (owner !== userId) return sum
    return sum + (li.price ?? 0)
  }, 0)
}

function computeStats(bids: Bid[], userId: string | null): DashboardStats {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekLater = new Date(now)
  weekLater.setDate(weekLater.getDate() + 7)
  const weekStr = weekLater.toISOString().slice(0, 10)

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`

  const activeBids = bids.filter((b) => b.status === 'Bidding' || b.status === 'In Progress')

  // Pipeline value: sum per-user scope value when we know who the user is so a
  // partial assignment (some scopes only) doesn't credit the full bid total.
  const pipelineValue = userId
    ? activeBids.reduce((sum, b) => sum + userBidValue(b, userId), 0)
    : activeBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)

  return {
    activeCount: activeBids.length,
    sentCount: bids.filter((b) => b.status === 'Sent').length,
    awardedCount: bids.filter((b) => b.status === 'Awarded').length,
    lostCount: bids.filter((b) => b.status === 'Lost').length,
    pipelineValue,
    bidsDueThisWeek: bids.filter(
      (b) =>
        b.bid_due_date >= todayStr &&
        b.bid_due_date <= weekStr &&
        (b.status === 'Bidding' || b.status === 'In Progress')
    ),
    sentThisMonth: bids.filter(
      (b) => b.status === 'Sent' && b.updated_at >= monthStart
    ).length,
    awardedYTD: bids.filter(
      (b) => b.status === 'Awarded' && b.updated_at >= yearStart
    ).length,
    totalActiveEstimators: 0, // populated separately for Admin
  }
}

function computeBranchBreakdown(bids: Bid[]): BranchBreakdownItem[] {
  return ALL_BRANCHES.map((branch) => {
    const branchBids = bids.filter((b) => b.branch === branch)
    const activeBids = branchBids.filter(
      (b) => b.status === 'Bidding' || b.status === 'In Progress'
    )
    return {
      branch,
      pipelineValue: activeBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0),
      activeCount: activeBids.length,
      sentCount: branchBids.filter((b) => b.status === 'Sent').length,
      awardedCount: branchBids.filter((b) => b.status === 'Awarded').length,
    }
  })
}

function computeEstimatorBreakdown(
  bids: Bid[],
  profileBranches: Record<string, string>
): EstimatorBreakdown[] {
  const map = new Map<string, EstimatorBreakdown>()

  function ensure(id: string, name: string) {
    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        branch: profileBranches[id] ?? '',
        activeBids: 0,
        sentCount: 0,
        awardedCount: 0,
        pipelineValue: 0,
      })
    }
    return map.get(id)!
  }

  // Build a set of (estimatorId → bidIds touched) so activeBids/sentCount/awardedCount
  // reflect "bids the estimator has any responsibility on", not just bids they lead.
  const seen = new Map<string, Set<string>>()

  for (const bid of bids) {
    const owners = new Map<string, string>() // estimatorId → estimator name
    if (bid.estimator_id && bid.estimator_name) {
      owners.set(bid.estimator_id, bid.estimator_name)
    }
    for (const li of bid.line_items ?? []) {
      const ownerId = li.estimator_id ?? bid.estimator_id
      const ownerName = li.estimator_id ? li.estimator_name : bid.estimator_name
      if (ownerId && ownerName) owners.set(ownerId, ownerName)
    }

    for (const [ownerId, ownerName] of owners) {
      const entry = ensure(ownerId, ownerName)
      if (!seen.has(ownerId)) seen.set(ownerId, new Set())
      const seenBids = seen.get(ownerId)!
      if (!seenBids.has(bid.id)) {
        seenBids.add(bid.id)
        if (bid.status === 'Bidding' || bid.status === 'In Progress') entry.activeBids++
        if (bid.status === 'Sent') entry.sentCount++
        if (bid.status === 'Awarded') entry.awardedCount++
      }
      if (bid.status === 'Bidding' || bid.status === 'In Progress') {
        entry.pipelineValue += userBidValue(bid, ownerId)
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.pipelineValue - a.pipelineValue)
}

function computeScopeBreakdown(bids: Bid[]): ScopeBreakdownItem[] {
  const activeBids = bids.filter(
    (b) => b.status === 'Bidding' || b.status === 'In Progress'
  )
  const scopeMap = new Map<BidScope, Set<string>>(
    ALL_SCOPES.map((s) => [s, new Set()])
  )
  for (const bid of activeBids) {
    for (const li of bid.line_items ?? []) {
      scopeMap.get(li.scope)?.add(bid.id)
    }
  }
  return ALL_SCOPES.map((scope) => ({
    scope,
    count: scopeMap.get(scope)?.size ?? 0,
  })).filter((item) => item.count > 0)
}

export function useDashboard(): UseDashboardResult {
  const [result, setResult] = useState<UseDashboardResult>({
    stats: null,
    recentBids: [],
    allBids: [],
    orgBids: [],
    branchBreakdown: [],
    estimatorBreakdown: [],
    scopeBreakdown: [],
    loading: true,
    error: null,
  })

  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile, loading: roleLoading } =
    useUserRole()

  const fetchDashboard = useCallback(async () => {
    const supabase = createClient()

    const BID_QUERY = `
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
      bid_line_items(*, estimator:profiles!bid_line_items_estimator_id_fkey(name)),
      bid_clients(*, clients(name))
    `

    // Personal query: fetch by branch scope (or all for admin), then filter
    // client-side so a user picks up bids they own a scope on, not just bids
    // they lead. PostgREST doesn't support `OR` across a joined table, so the
    // intersection has to happen in JS.
    let query = supabase
      .from('bids')
      .select(BID_QUERY)
      .order('created_at', { ascending: false })

    if (!isAdmin && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }

    // Build org-wide and profile queries for Admin/BranchManager (run in parallel with personal query)
    const needsOrgData = isAdmin || isBranchManager
    let orgQueryPromise: PromiseLike<{ data: any[] | null; error: any }> | null = null
    let profileQueryPromise: PromiseLike<{ data: any[] | null }> | null = null

    if (needsOrgData) {
      let orgQuery = supabase
        .from('bids')
        .select(BID_QUERY)
        .order('created_at', { ascending: false })

      if (isBranchManager && userBranches.length > 0) {
        orgQuery = orgQuery.in('branch', userBranches)
      }

      orgQueryPromise = orgQuery
      profileQueryPromise = supabase
        .from('profiles')
        .select('id, user_branches(branch)')
        .eq('role', 'estimator')
        .eq('is_active', true)
    }

    // Run all queries concurrently
    const [personalResult, orgResult, profileResult] = await Promise.all([
      query,
      orgQueryPromise ?? Promise.resolve({ data: null, error: null }),
      profileQueryPromise ?? Promise.resolve({ data: null }),
    ])

    const { data, error: fetchError } = personalResult

    if (fetchError) {
      setResult((prev) => ({ ...prev, loading: false, error: fetchError.message }))
      return
    }

    const allFetched: Bid[] = (data ?? []).map(mapBidRow)
    // "Personal" bids = bids the user leads OR owns at least one scope on.
    const bids: Bid[] = profile
      ? allFetched.filter((b) => userIsOnBid(b, profile.id))
      : allFetched
    const orgBids: Bid[] = (orgResult.data ?? []).map(mapBidRow)

    let profileBranches: Record<string, string> = {}
    let totalActiveEstimators = 0

    if (profileResult.data) {
      totalActiveEstimators = profileResult.data.length
      for (const p of profileResult.data as any[]) {
        const branches = (p.user_branches ?? []).map((ub: any) => ub.branch).filter(Boolean)
        profileBranches[p.id] = branches.join(', ')
      }
    }

    const stats = computeStats(bids, profile?.id ?? null)
    stats.totalActiveEstimators = totalActiveEstimators

    const recentBids = bids.slice(0, 8)
    const branchBreakdown = isAdmin ? computeBranchBreakdown(orgBids) : []
    const estimatorBreakdown =
      isAdmin || isBranchManager ? computeEstimatorBreakdown(orgBids, profileBranches) : []
    const scopeBreakdown = isAdmin ? computeScopeBreakdown(orgBids) : []

    setResult({
      stats,
      recentBids,
      allBids: bids,
      orgBids,
      branchBreakdown,
      estimatorBreakdown,
      scopeBreakdown,
      loading: false,
      error: null,
    })
  }, [isAdmin, isBranchManager, userBranches, profile])

  useEffect(() => {
    if (roleLoading) return
    setResult((prev) => ({ ...prev, loading: true }))
    fetchDashboard()
  }, [fetchDashboard, roleLoading])

  // Realtime: any change to a bid, line item, or client junction invalidates
  // the aggregations. Refetch on every event — cheap relative to the impact
  // of stale KPIs.
  useEffect(() => {
    if (roleLoading) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-${profile?.id ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        fetchDashboard()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_line_items' }, () => {
        fetchDashboard()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_clients' }, () => {
        fetchDashboard()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDashboard, roleLoading, profile?.id])

  return result
}
