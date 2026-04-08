'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import type { Bid, BidLineItem, Branch, BidScope } from '@/lib/supabase/types'

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
  const line_items: BidLineItem[] = row.bid_line_items ?? []
  const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
  return {
    ...row,
    estimator_name: row.profiles?.name ?? null,
    line_items,
    total_price,
  }
}

function computeStats(bids: Bid[]): DashboardStats {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekLater = new Date(now)
  weekLater.setDate(weekLater.getDate() + 7)
  const weekStr = weekLater.toISOString().slice(0, 10)

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`

  const activeBids = bids.filter((b) => b.status === 'Bidding' || b.status === 'In Progress')

  return {
    activeCount: activeBids.length,
    sentCount: bids.filter((b) => b.status === 'Sent').length,
    awardedCount: bids.filter((b) => b.status === 'Awarded').length,
    lostCount: bids.filter((b) => b.status === 'Lost').length,
    pipelineValue: activeBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0),
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

  for (const bid of bids) {
    if (!bid.estimator_id || !bid.estimator_name) continue
    if (!map.has(bid.estimator_id)) {
      map.set(bid.estimator_id, {
        id: bid.estimator_id,
        name: bid.estimator_name,
        branch: profileBranches[bid.estimator_id] ?? '',
        activeBids: 0,
        sentCount: 0,
        awardedCount: 0,
        pipelineValue: 0,
      })
    }
    const entry = map.get(bid.estimator_id)!
    if (bid.status === 'Bidding' || bid.status === 'In Progress') {
      entry.activeBids++
      entry.pipelineValue += bid.total_price ?? 0
    }
    if (bid.status === 'Sent') entry.sentCount++
    if (bid.status === 'Awarded') entry.awardedCount++
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
      bid_line_items(*)
    `

    let query = supabase
      .from('bids')
      .select(BID_QUERY)
      .order('created_at', { ascending: false })

    if (isEstimator && profile) {
      query = query.eq('estimator_id', profile.id)
    } else if (isBranchManager && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }
    // Admin: no additional filter

    const { data, error: fetchError } = await query

    if (fetchError) {
      setResult((prev) => ({ ...prev, loading: false, error: fetchError.message }))
      return
    }

    const bids: Bid[] = (data ?? []).map(mapBidRow)

    // Fetch active estimator count and profile branches for Admin/BranchManager
    let profileBranches: Record<string, string> = {}
    let totalActiveEstimators = 0

    if (isAdmin || isBranchManager) {
      const profileQuery = supabase
        .from('profiles')
        .select('id, user_branches(branch)')
        .eq('role', 'estimator')
        .eq('is_active', true)

      const { data: profileData } = await profileQuery

      if (profileData) {
        totalActiveEstimators = profileData.length
        for (const p of profileData as any[]) {
          const branches = (p.user_branches ?? []).map((ub: any) => ub.branch).filter(Boolean)
          profileBranches[p.id] = branches.join(', ')
        }
      }
    }

    const stats = computeStats(bids)
    stats.totalActiveEstimators = totalActiveEstimators

    const recentBids = bids.slice(0, 5)
    const branchBreakdown = isAdmin ? computeBranchBreakdown(bids) : []
    const estimatorBreakdown =
      isAdmin || isBranchManager ? computeEstimatorBreakdown(bids, profileBranches) : []
    const scopeBreakdown = isAdmin ? computeScopeBreakdown(bids) : []

    setResult({
      stats,
      recentBids,
      branchBreakdown,
      estimatorBreakdown,
      scopeBreakdown,
      loading: false,
      error: null,
    })
  }, [isAdmin, isBranchManager, isEstimator, userBranches, profile])

  useEffect(() => {
    if (roleLoading) return
    setResult((prev) => ({ ...prev, loading: true }))
    fetchDashboard()
  }, [fetchDashboard, roleLoading])

  return result
}
