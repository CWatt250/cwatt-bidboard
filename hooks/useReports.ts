'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import type { Bid, BidLineItem, Branch, BidScope, BidStatus } from '@/lib/supabase/types'

// ─── Filter Types ────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateRange: { from: string | null; to: string | null }
  branches: Branch[]
  estimators: string[] // estimator_ids
  scopes: BidScope[]
  statuses: BidStatus[]
}

export const DEFAULT_FILTERS: ReportFilters = {
  dateRange: { from: null, to: null },
  branches: [],
  estimators: [],
  scopes: [],
  statuses: [],
}

// ─── Metric Types ─────────────────────────────────────────────────────────────

export interface ByBranchRow {
  branch: Branch
  totalBids: number
  pipeline: number
  sent: number
  awarded: number
  lost: number
  winRate: number
}

export interface ByEstimatorRow {
  estimatorId: string
  name: string
  branch: string
  totalBids: number
  pipeline: number
  sent: number
  awarded: number
  lost: number
  winRate: number
}

export interface ByScopeRow {
  scope: BidScope
  count: number
  totalValue: number
}

export interface ByMonthRow {
  month: string // "Mar 2026"
  created: number
  sent: number
  awarded: number
}

export interface ReportMetrics {
  totalPipeline: number
  totalBids: number
  sentCount: number
  awardedCount: number
  lostCount: number
  winRate: number
  byBranch: ByBranchRow[]
  byEstimator: ByEstimatorRow[]
  byScope: ByScopeRow[]
  byMonth: ByMonthRow[]
}

export interface EstimatorOption {
  id: string
  name: string
  branch: string
}

export interface UseReportsResult {
  metrics: ReportMetrics | null
  filteredBids: Bid[]
  allEstimators: EstimatorOption[]
  loading: boolean
  error: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcWinRate(awarded: number, sent: number): number {
  if (sent === 0) return 0
  return Math.round((awarded / sent) * 1000) / 10
}

function mapBidRow(row: any): Bid {
  const line_items: BidLineItem[] = row.bid_line_items ?? []
  const total_price = line_items.reduce((sum: number, li: any) => sum + (li.price ?? 0), 0)
  return {
    ...row,
    estimator_name: row.profiles?.name ?? null,
    line_items,
    total_price,
  }
}

function applyFilters(bids: Bid[], filters: ReportFilters): Bid[] {
  let result = bids

  if (filters.dateRange.from) {
    result = result.filter((b) => b.created_at >= filters.dateRange.from!)
  }
  if (filters.dateRange.to) {
    result = result.filter((b) => b.created_at <= filters.dateRange.to! + 'T23:59:59')
  }
  if (filters.branches.length > 0) {
    result = result.filter((b) => filters.branches.includes(b.branch))
  }
  if (filters.estimators.length > 0) {
    result = result.filter(
      (b) => b.estimator_id !== null && filters.estimators.includes(b.estimator_id)
    )
  }
  if (filters.scopes.length > 0) {
    result = result.filter((b) =>
      b.line_items?.some((li) => filters.scopes.includes(li.scope))
    )
  }
  if (filters.statuses.length > 0) {
    result = result.filter((b) => filters.statuses.includes(b.status))
  }
  return result
}

function computeMetrics(bids: Bid[], profileBranches: Record<string, string>): ReportMetrics {
  const totalBids = bids.length
  const sentCount = bids.filter((b) => b.status === 'Sent').length
  const awardedCount = bids.filter((b) => b.status === 'Awarded').length
  const lostCount = bids.filter((b) => b.status === 'Lost').length
  const totalPipeline = bids
    .filter((b) => b.status === 'Bidding' || b.status === 'In Progress')
    .reduce((sum, b) => sum + (b.total_price ?? 0), 0)

  // ── By Branch ──
  const byBranch: ByBranchRow[] = ALL_BRANCHES.map((branch) => {
    const bb = bids.filter((b) => b.branch === branch)
    const awarded = bb.filter((b) => b.status === 'Awarded').length
    const lost = bb.filter((b) => b.status === 'Lost').length
    const sent = bb.filter((b) => b.status === 'Sent').length
    return {
      branch,
      totalBids: bb.length,
      pipeline: bb
        .filter((b) => b.status === 'Bidding' || b.status === 'In Progress')
        .reduce((sum, b) => sum + (b.total_price ?? 0), 0),
      sent,
      awarded,
      lost,
      winRate: calcWinRate(awarded, sent),
    }
  })

  // ── By Estimator ──
  const estMap = new Map<string, ByEstimatorRow>()
  for (const bid of bids) {
    if (!bid.estimator_id || !bid.estimator_name) continue
    if (!estMap.has(bid.estimator_id)) {
      estMap.set(bid.estimator_id, {
        estimatorId: bid.estimator_id,
        name: bid.estimator_name,
        branch: profileBranches[bid.estimator_id] ?? '',
        totalBids: 0,
        pipeline: 0,
        sent: 0,
        awarded: 0,
        lost: 0,
        winRate: 0,
      })
    }
    const e = estMap.get(bid.estimator_id)!
    e.totalBids++
    if (bid.status === 'Bidding' || bid.status === 'In Progress') {
      e.pipeline += bid.total_price ?? 0
    }
    if (bid.status === 'Sent') e.sent++
    if (bid.status === 'Awarded') e.awarded++
    if (bid.status === 'Lost') e.lost++
  }
  const byEstimator = Array.from(estMap.values())
    .map((e) => ({ ...e, winRate: calcWinRate(e.awarded, e.sent) }))
    .sort((a, b) => b.pipeline - a.pipeline)

  // ── By Scope ──
  const scopeMap = new Map<BidScope, { bidIds: Set<string>; totalValue: number }>(
    ALL_SCOPES.map((s) => [s, { bidIds: new Set(), totalValue: 0 }])
  )
  for (const bid of bids) {
    for (const li of bid.line_items ?? []) {
      const entry = scopeMap.get(li.scope)
      if (entry) {
        entry.bidIds.add(bid.id)
        entry.totalValue += li.price ?? 0
      }
    }
  }
  const byScope: ByScopeRow[] = ALL_SCOPES.map((scope) => {
    const entry = scopeMap.get(scope)!
    return { scope, count: entry.bidIds.size, totalValue: entry.totalValue }
  }).sort((a, b) => b.totalValue - a.totalValue)

  // ── By Month — last 6 months, most recent first ──
  const now = new Date()
  const byMonth: ByMonthRow[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    byMonth.push({
      month: monthLabel,
      created: bids.filter((b) => b.created_at.startsWith(monthKey)).length,
      sent: bids.filter((b) => b.status === 'Sent' && b.updated_at.startsWith(monthKey)).length,
      awarded: bids.filter((b) => b.status === 'Awarded' && b.updated_at.startsWith(monthKey))
        .length,
    })
  }

  return {
    totalPipeline,
    totalBids,
    sentCount,
    awardedCount,
    lostCount,
    winRate: calcWinRate(awardedCount, sentCount),
    byBranch,
    byEstimator,
    byScope,
    byMonth,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReports(filters: ReportFilters = DEFAULT_FILTERS): UseReportsResult {
  const [allBids, setAllBids] = useState<Bid[]>([])
  const [profileBranches, setProfileBranches] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    isAdmin,
    isBranchManager,
    isEstimator,
    branches: userBranches,
    loading: roleLoading,
  } = useUserRole()

  const fetchData = useCallback(async () => {
    // Estimators are not authorized
    if (isEstimator) {
      setAllBids([])
      setLoading(false)
      return
    }

    const supabase = createClient()
    let query = supabase.from('bids').select(BID_QUERY).order('created_at', { ascending: false })

    if (isBranchManager && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }
    // Admin: no additional filter

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const bids: Bid[] = (data ?? []).map(mapBidRow)

    // Fetch profile branches for estimator breakdown column
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, user_branches(branch)')
      .eq('role', 'estimator')
      .eq('is_active', true)

    const branches: Record<string, string> = {}
    if (profileData) {
      for (const p of profileData as any[]) {
        branches[p.id] = p.user_branches?.[0]?.branch ?? ''
      }
    }

    setAllBids(bids)
    setProfileBranches(branches)
    setError(null)
    setLoading(false)
  }, [isAdmin, isBranchManager, isEstimator, userBranches])

  useEffect(() => {
    if (roleLoading) return
    setLoading(true)
    fetchData()
  }, [fetchData, roleLoading])

  const filteredBids = useMemo(() => applyFilters(allBids, filters), [allBids, filters])

  const metrics = useMemo(
    () => (loading ? null : computeMetrics(filteredBids, profileBranches)),
    [filteredBids, profileBranches, loading]
  )

  const allEstimators = useMemo((): EstimatorOption[] => {
    const map = new Map<string, EstimatorOption>()
    for (const bid of allBids) {
      if (!bid.estimator_id || !bid.estimator_name) continue
      if (!map.has(bid.estimator_id)) {
        map.set(bid.estimator_id, {
          id: bid.estimator_id,
          name: bid.estimator_name,
          branch: profileBranches[bid.estimator_id] ?? '',
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allBids, profileBranches])

  return { metrics, filteredBids, allEstimators, loading, error }
}
