import { startOfWeek, endOfWeek } from 'date-fns'
import type { Bid, Branch, WorkspaceTodo } from '@/lib/supabase/types'

export interface WeekRange {
  start: Date
  end: Date
}

export interface WeekTotals {
  count: number
  total: number
  /** The specific bids that make up this total — for drill-down drawers. */
  bids: Bid[]
}

export interface AtRiskSummary {
  count: number
  total: number
  earliestDue: Date | null
}

export interface BranchBreakdownItem {
  branch: Branch
  count: number
  total: number
}

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

const PRE_SENT_STATUSES = new Set<Bid['status']>(['Unassigned', 'Bidding', 'In Progress'])

function bidDueDate(b: Bid): Date | null {
  if (!b.bid_due_date) return null
  return new Date(b.bid_due_date + 'T00:00:00')
}

function lineItemTotal(b: Bid): number {
  if (typeof b.total_price === 'number') return b.total_price
  return (b.line_items ?? []).reduce((sum, li) => sum + (li.price ?? 0), 0)
}

/**
 * A bid's value scoped to a single estimator. With `estimatorId === null` this
 * is the full bid total; otherwise it sums only the line items belonging to
 * that estimator — either explicitly assigned to them, or unassigned and so
 * inheriting the bid's primary estimator. Returns 0 when none match.
 */
export function estimatorScopedPrice(bid: Bid, estimatorId: string | null): number {
  if (estimatorId === null) return lineItemTotal(bid)
  return (bid.line_items ?? []).reduce((sum, li) => {
    const mine =
      li.estimator_id === estimatorId ||
      (li.estimator_id === null && bid.estimator_id === estimatorId)
    return mine ? sum + (li.price ?? 0) : sum
  }, 0)
}

export function weekRange(date: Date): WeekRange {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function bidsInWeek(bids: Bid[], weekStart: Date, weekEnd: Date): Bid[] {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  return bids.filter((b) => {
    const due = bidDueDate(b)
    if (!due) return false
    const t = due.getTime()
    return t >= startMs && t <= endMs
  })
}

export function bidTotalValue(bids: Bid[], estimatorId: string | null = null): number {
  return bids.reduce((sum, b) => sum + estimatorScopedPrice(b, estimatorId), 0)
}

export function securedInWeek(
  bids: Bid[],
  weekStart: Date,
  weekEnd: Date,
  estimatorId: string | null = null,
): WeekTotals {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  const wonBids = new Map<string, Bid>()
  let total = 0
  for (const b of bids) {
    for (const li of b.line_items ?? []) {
      if (!li.is_awarded || !li.awarded_at) continue
      const t = new Date(li.awarded_at).getTime()
      if (t < startMs || t > endMs) continue
      wonBids.set(b.id, b)
      // Which bids count as secured is unchanged; the dollar total is scoped
      // to the estimator's own awarded line items when an estimator is set.
      const mine =
        estimatorId === null ||
        li.estimator_id === estimatorId ||
        (li.estimator_id === null && b.estimator_id === estimatorId)
      if (mine) total += li.price ?? 0
    }
  }
  return { count: wonBids.size, total, bids: Array.from(wonBids.values()) }
}

export function verbalsInWeek(
  bids: Bid[],
  weekStart: Date,
  weekEnd: Date,
  estimatorId: string | null = null,
): WeekTotals {
  // We don't track a verbal_at timestamp, so this is a proxy: bids currently in
  // status 'Verbal' whose row updated_at lands in the week. Edits to other
  // fields will move them in and out of this bucket.
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  const matching = bids.filter((b) => {
    if (b.status !== 'Verbal' || !b.updated_at) return false
    const t = new Date(b.updated_at).getTime()
    return t >= startMs && t <= endMs
  })
  return {
    count: matching.length,
    total: matching.reduce((sum, b) => sum + estimatorScopedPrice(b, estimatorId), 0),
    bids: matching,
  }
}

export function atRiskBids(bids: Bid[], today: Date): AtRiskSummary {
  const todayMidnight = new Date(today)
  todayMidnight.setHours(0, 0, 0, 0)
  const cutoff = todayMidnight.getTime()

  let count = 0
  let total = 0
  let earliestDue: Date | null = null

  for (const b of bids) {
    if (!PRE_SENT_STATUSES.has(b.status)) continue
    const due = bidDueDate(b)
    if (!due) continue
    if (due.getTime() >= cutoff) continue
    count++
    total += lineItemTotal(b)
    if (!earliestDue || due.getTime() < earliestDue.getTime()) {
      earliestDue = due
    }
  }
  return { count, total, earliestDue }
}

export function branchBreakdownThisWeek(
  bids: Bid[],
  weekStart: Date,
  weekEnd: Date,
  estimatorId: string | null = null,
): BranchBreakdownItem[] {
  const inWeek = bidsInWeek(bids, weekStart, weekEnd)
  return ALL_BRANCHES.map((branch) => {
    const branchBids = inWeek.filter((b) => b.branch === branch)
    return {
      branch,
      count: branchBids.length,
      total: bidTotalValue(branchBids, estimatorId),
    }
  })
}

export function completedTasksInWeek(
  tasks: WorkspaceTodo[],
  weekStart: Date,
  weekEnd: Date,
): WorkspaceTodo[] {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  return tasks.filter((t) => {
    if (!t.is_completed || !t.completed_at) return false
    const tMs = new Date(t.completed_at).getTime()
    return tMs >= startMs && tMs <= endMs
  })
}

// ─── Monthly recap ─────────────────────────────────────────────────────────

export interface MonthRange {
  start: Date
  end: Date
}

export interface BranchMonthlyStats {
  branch: Branch
  submitted: number
  totalValue: number
  secured: number
}

export interface BundledStats {
  submitted: number
  totalValue: number
  secured: number
}

export function monthRange(year: number, month: number): MonthRange {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start, end }
}

export function bidsInMonth(bids: Bid[], year: number, month: number): Bid[] {
  const { start, end } = monthRange(year, month)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return bids.filter((b) => {
    const due = bidDueDate(b)
    if (!due) return false
    const t = due.getTime()
    return t >= startMs && t <= endMs
  })
}

function securedFromBid(b: Bid): number {
  const isWon = b.status === 'Awarded' || b.status === 'Verbal'
  if (isWon) {
    return (b.line_items ?? [])
      .filter((li) => li.is_awarded)
      .reduce((sum, li) => sum + (li.price ?? 0), 0)
  }
  return (b.line_items ?? []).reduce((sum, li) => sum + (li.price ?? 0), 0)
}

export function monthlyBranchStats(
  bids: Bid[],
  branches: Branch[],
  year: number,
  month: number,
): BranchMonthlyStats[] {
  const inMonth = bidsInMonth(bids, year, month)
  return branches.map((branch) => {
    const branchBids = inMonth.filter((b) => b.branch === branch)
    return {
      branch,
      submitted: branchBids.length,
      totalValue: branchBids.reduce((sum, b) => sum + lineItemTotal(b), 0),
      secured: branchBids.reduce((sum, b) => sum + securedFromBid(b), 0),
    }
  })
}

export function bundledStats(
  bids: Bid[],
  year: number,
  month: number,
): BundledStats {
  const inMonth = bidsInMonth(bids, year, month)
  return {
    submitted: inMonth.length,
    totalValue: inMonth.reduce((sum, b) => sum + lineItemTotal(b), 0),
    secured: inMonth.reduce((sum, b) => sum + securedFromBid(b), 0),
  }
}
