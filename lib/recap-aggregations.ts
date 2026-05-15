import { startOfWeek, endOfWeek } from 'date-fns'
import type { Bid, Branch, WorkspaceTodo } from '@/lib/supabase/types'

export interface WeekRange {
  start: Date
  end: Date
}

export interface WeekTotals {
  count: number
  total: number
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

export function bidTotalValue(bids: Bid[]): number {
  return bids.reduce((sum, b) => sum + lineItemTotal(b), 0)
}

export function securedInWeek(bids: Bid[], weekStart: Date, weekEnd: Date): WeekTotals {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  const wonBids = new Set<string>()
  let total = 0
  for (const b of bids) {
    for (const li of b.line_items ?? []) {
      if (!li.is_awarded || !li.awarded_at) continue
      const t = new Date(li.awarded_at).getTime()
      if (t < startMs || t > endMs) continue
      wonBids.add(b.id)
      total += li.price ?? 0
    }
  }
  return { count: wonBids.size, total }
}

export function verbalsInWeek(bids: Bid[], weekStart: Date, weekEnd: Date): WeekTotals {
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
    total: matching.reduce((sum, b) => sum + lineItemTotal(b), 0),
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
): BranchBreakdownItem[] {
  const inWeek = bidsInWeek(bids, weekStart, weekEnd)
  return ALL_BRANCHES.map((branch) => {
    const branchBids = inWeek.filter((b) => b.branch === branch)
    return {
      branch,
      count: branchBids.length,
      total: bidTotalValue(branchBids),
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
