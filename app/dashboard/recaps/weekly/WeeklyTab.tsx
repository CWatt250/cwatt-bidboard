'use client'

import { useMemo, useState, useEffect } from 'react'
import { format, subDays, addDays, startOfWeek, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRecapData } from '@/hooks/useRecapData'
import { useUserRole } from '@/contexts/userRole'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  atRiskBids,
  bidTotalValue,
  bidsInWeek,
  branchBreakdownThisWeek,
  completedTasksInWeek,
  securedInWeek,
  verbalsInWeek,
  weekRange,
} from '@/lib/recap-aggregations'
import type { WorkspaceTodo } from '@/lib/supabase/types'
import { AtRiskCallout } from './AtRiskCallout'
import { AtRiskDrawer } from './AtRiskDrawer'
import { BidsTable } from './BidsTable'
import { QuickTotalsRail } from './QuickTotalsRail'
import { WeeklyBidsDrawer } from './WeeklyBidsDrawer'

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseYmd(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isValid(d) ? d : null
}

function isSameWeek(date1: Date, date2: Date): boolean {
  const s1 = startOfWeek(date1, { weekStartsOn: 1 })
  const s2 = startOfWeek(date2, { weekStartsOn: 1 })
  return s1.getTime() === s2.getTime()
}

function formatWeekRange(start: Date, end: Date): string {
  const fmt = 'MMM d, yyyy'
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, fmt)}`
  }
  return `${format(start, fmt)} – ${format(end, fmt)}`
}

function formatCompletedTime(dateStr: string): string {
  const d = new Date(dateStr)
  return format(d, "'Completed' E MMM d 'at' h:mma")
}

/** Sentinel <Select> value for the admin "show every estimator" option. */
const ALL_ESTIMATORS = '__all_estimators__'

export function WeeklyTab() {
  const { bids, loading, error } = useRecapData()
  const { profile, isAdmin } = useUserRole()
  const [selectedEstimator, setSelectedEstimator] = useState<string | null>(null)
  const [securedDrawerOpen, setSecuredDrawerOpen] = useState(false)
  const [verbalsDrawerOpen, setVerbalsDrawerOpen] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<WorkspaceTodo[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // Fetch tasks for completed-tasks-this-week section
  useEffect(() => {
    if (!userId) return
    setTasksLoading(true)
    const supabase = createClient()
    supabase
      .from('workspace_todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTasks(data ?? [])
        setTasksLoading(false)
      })
  }, [userId])

  // The week the user is reviewing. Defaults to "this week" (the Monday-Sunday
  // containing today). All downstream ranges hang off this anchor.
  const [anchor, setAnchor] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [atRiskOpen, setAtRiskOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  // Estimator options for the admin dropdown — derived from already-loaded bids.
  // The <Select> is keyed by name (so the trigger shows the person's name), but
  // the estimator's id is kept alongside it for scope-price computation.
  const estimatorOptions = useMemo(() => {
    const byName = new Map<string, string>()
    for (const b of bids) {
      if (b.estimator_name && b.estimator_id && !byName.has(b.estimator_name)) {
        byName.set(b.estimator_name, b.estimator_id)
      }
    }
    return Array.from(byName, ([name, id]) => ({ name, id })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }, [bids])

  // The estimator whose scope prices the recap should narrow to. Non-admins are
  // always scoped to themselves; admins are scoped only when a specific
  // estimator is picked ("All estimators" → null → full bid totals).
  const activeEstimatorId = useMemo(() => {
    if (!isAdmin) return profile?.id ?? null
    if (!selectedEstimator) return null
    return estimatorOptions.find((e) => e.name === selectedEstimator)?.id ?? null
  }, [isAdmin, profile, selectedEstimator, estimatorOptions])

  // Recap scope: non-admins only ever see their own bids; admins see org-wide
  // unless they pick a specific estimator (matched by estimator name).
  const filteredBids = useMemo(() => {
    if (!isAdmin) {
      return profile ? bids.filter((b) => b.estimator_id === profile.id) : []
    }
    if (!selectedEstimator) return bids
    return bids.filter((b) => b.estimator_name === selectedEstimator)
  }, [bids, isAdmin, profile, selectedEstimator])

  const thisWeek = useMemo(() => weekRange(anchor), [anchor])
  const lastWeek = useMemo(() => weekRange(subDays(anchor, 7)), [anchor])

  const lastWeekBids = useMemo(
    () => bidsInWeek(filteredBids, lastWeek.start, lastWeek.end),
    [filteredBids, lastWeek],
  )
  const thisWeekBids = useMemo(
    () => bidsInWeek(filteredBids, thisWeek.start, thisWeek.end),
    [filteredBids, thisWeek],
  )

  const lastWeekTotals = useMemo(
    () => ({
      count: lastWeekBids.length,
      total: bidTotalValue(lastWeekBids, activeEstimatorId),
    }),
    [lastWeekBids, activeEstimatorId],
  )
  const thisWeekTotals = useMemo(
    () => ({
      count: thisWeekBids.length,
      total: bidTotalValue(thisWeekBids, activeEstimatorId),
    }),
    [thisWeekBids, activeEstimatorId],
  )

  const securedLastWeek = useMemo(
    () => securedInWeek(filteredBids, lastWeek.start, lastWeek.end, activeEstimatorId),
    [filteredBids, lastWeek, activeEstimatorId],
  )
  const verbalsLastWeek = useMemo(
    () => verbalsInWeek(filteredBids, lastWeek.start, lastWeek.end, activeEstimatorId),
    [filteredBids, lastWeek, activeEstimatorId],
  )
  const branchBreakdown = useMemo(
    () => branchBreakdownThisWeek(filteredBids, thisWeek.start, thisWeek.end, activeEstimatorId),
    [filteredBids, thisWeek, activeEstimatorId],
  )
  const atRisk = useMemo(() => atRiskBids(filteredBids, new Date()), [filteredBids])
  const atRiskBidList = useMemo(
    () =>
      filteredBids.filter((b) => {
        const preSentStatuses = new Set(['Unassigned', 'Bidding', 'In Progress'])
        if (!preSentStatuses.has(b.status)) return false
        if (!b.bid_due_date) return false
        const due = new Date(b.bid_due_date + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return due.getTime() < today.getTime()
      }),
    [filteredBids],
  )

  const lastWeekSentCount = lastWeekBids.filter((b) => b.status === 'Sent').length
  const thisWeekSentCount = thisWeekBids.filter((b) => b.status === 'Sent').length

  const thisWeekCompletedTasks = useMemo(
    () => completedTasksInWeek(tasks, thisWeek.start, thisWeek.end),
    [tasks, thisWeek],
  )

  const isCurrentWeek = isSameWeek(anchor, new Date())

  const lastRangeLabel = `${format(lastWeek.start, 'MMM d')} – ${format(lastWeek.end, 'MMM d')}`
  const thisRangeLabel = `${format(thisWeek.start, 'MMM d')} – ${format(thisWeek.end, 'MMM d')}`

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          color: '#b91c1c',
        }}
      >
        Failed to load recap data: {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          className="animate-pulse"
          style={{
            height: 56,
            borderRadius: 'var(--radius-lg, var(--radius))',
            background: 'var(--surface2)',
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 320px',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="animate-pulse" style={{ height: 220, borderRadius: 12, background: 'var(--surface2)' }} />
            <div className="animate-pulse" style={{ height: 220, borderRadius: 12, background: 'var(--surface2)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{ height: 84, borderRadius: 12, background: 'var(--surface2)' }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* At-risk drawer */}
      <AtRiskDrawer
        open={atRiskOpen}
        onOpenChange={setAtRiskOpen}
        bids={atRiskBidList}
        userId={userId}
      />

      {/* Header with week navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.2px',
            }}
          >
            Weekly Recap
          </h2>
        </div>

        {/* Estimator filter (admin) + week navigator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text2)',
                  whiteSpace: 'nowrap',
                }}
              >
                Estimator
              </span>
              <Select
                value={selectedEstimator ?? ALL_ESTIMATORS}
                onValueChange={(v) =>
                  setSelectedEstimator(v && v !== ALL_ESTIMATORS ? String(v) : null)
                }
              >
                <SelectTrigger className="w-[180px]" aria-label="Filter by estimator">
                  <SelectValue placeholder="All estimators" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ESTIMATORS}>All estimators</SelectItem>
                  {estimatorOptions.map((e) => (
                    <SelectItem key={e.name} value={e.name}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <button
            onClick={() => setAnchor((prev) => subDays(prev, 7))}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowPicker((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface2)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <CalendarIcon size={14} />
              <span>{formatWeekRange(thisWeek.start, thisWeek.end)}</span>
              {isCurrentWeek && (
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#d97706',
                    background: 'rgba(217, 119, 6, 0.12)',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  This week
                </span>
              )}
            </button>

            {showPicker && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 49,
                  }}
                  onClick={() => setShowPicker(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    zIndex: 50,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <input
                    type="date"
                    value={toYmd(thisWeek.start)}
                    onChange={(e) => {
                      const parsed = parseYmd(e.target.value)
                      if (parsed) {
                        setAnchor(startOfWeek(parsed, { weekStartsOn: 1 }))
                        setShowPicker(false)
                      }
                    }}
                    style={{
                      height: 32,
                      padding: '0 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '0.8rem',
                    }}
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setAnchor((prev) => addDays(prev, 7))}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* At-risk callout */}
      <AtRiskCallout summary={atRisk} onReviewClick={() => setAtRiskOpen(true)} />

      {/* Main grid */}
      <div
        className="recap-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <BidsTable
            title="Bids due last week"
            subtitle={`${lastRangeLabel} · ${lastWeekTotals.count} bid${lastWeekTotals.count === 1 ? '' : 's'} · ${formatCurrency(lastWeekTotals.total)} · ${lastWeekSentCount} sent`}
            bids={lastWeekBids}
            estimatorId={activeEstimatorId}
            emptyMessage="No bids were due last week."
          />
          <BidsTable
            title="Bids due this week"
            subtitle={`${thisRangeLabel} · ${thisWeekTotals.count} bid${thisWeekTotals.count === 1 ? '' : 's'} · ${formatCurrency(thisWeekTotals.total)} · ${thisWeekSentCount} sent`}
            bids={thisWeekBids}
            estimatorId={activeEstimatorId}
            emptyMessage="No bids are due this week."
          />

          {/* Completed tasks this week */}
          {thisWeekCompletedTasks.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                >
                  <circle cx="8" cy="8" r="7" stroke="#16a34a" strokeWidth="1.5" />
                  <path
                    d="M5 8l2 2 4-4"
                    stroke="#16a34a"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  Completed tasks this week ({thisWeekCompletedTasks.length})
                </p>
              </div>
              <div className="space-y-1.5">
                {thisWeekCompletedTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                    }}
                  >
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{ width: 10, height: 10, flexShrink: 0 }}
                    >
                      <circle cx="6" cy="6" r="5" stroke="#16a34a" strokeWidth="1" />
                      <path
                        d="M4 6l1.5 1.5L8 4"
                        stroke="#16a34a"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      className="truncate"
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text)',
                        flex: 1,
                        minWidth: 0,
                        textDecoration: 'line-through',
                        opacity: 0.7,
                      }}
                    >
                      {task.text}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text3)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatCompletedTime(task.completed_at!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <QuickTotalsRail
          lastWeek={lastWeekTotals}
          thisWeek={thisWeekTotals}
          secured={securedLastWeek}
          verbals={verbalsLastWeek}
          branchBreakdown={branchBreakdown}
          onSecuredClick={() => setSecuredDrawerOpen(true)}
          onVerbalsClick={() => setVerbalsDrawerOpen(true)}
        />
      </div>

      <WeeklyBidsDrawer
        open={securedDrawerOpen}
        onOpenChange={setSecuredDrawerOpen}
        title="Secured Last Week"
        subtitle={`${lastRangeLabel} · ${formatCurrency(securedLastWeek.total)} · ${securedLastWeek.count} bid${securedLastWeek.count === 1 ? '' : 's'}`}
        bids={securedLastWeek.bids}
        estimatorId={activeEstimatorId}
      />
      <WeeklyBidsDrawer
        open={verbalsDrawerOpen}
        onOpenChange={setVerbalsDrawerOpen}
        title="Verbals Last Week"
        subtitle={`${lastRangeLabel} · ${formatCurrency(verbalsLastWeek.total)} · ${verbalsLastWeek.count} bid${verbalsLastWeek.count === 1 ? '' : 's'}`}
        bids={verbalsLastWeek.bids}
        estimatorId={activeEstimatorId}
      />

      <style>{`
        @media (min-width: 1024px) {
          .recap-grid {
            grid-template-columns: minmax(0, 1fr) 320px !important;
          }
        }
      `}</style>
    </div>
  )
}
