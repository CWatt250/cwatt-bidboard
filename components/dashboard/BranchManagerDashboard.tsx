'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { useBidDetail } from '@/contexts/bidDetail'
import { TodoList } from '@/components/workspace/TodoList'
import { useUserRole } from '@/contexts/userRole'
import { STATUS_BADGE_CLASSES, DUE_DATE_URGENT_CLASS, DUE_DATE_WARNING_CLASS, BRANCH_BADGE_CLASSES } from '@/config/colors'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import type { Bid, Branch } from '@/lib/supabase/types'
import type { EstimatorBreakdown } from '@/hooks/useDashboard'

type SortKey = keyof Pick<EstimatorBreakdown, 'activeBids' | 'sentCount' | 'awardedCount' | 'pipelineValue'>

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function dueDateClass(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 3) return DUE_DATE_URGENT_CLASS
  if (diff <= 7) return DUE_DATE_WARNING_CLASS
  return 'text-muted-foreground'
}

function MetricCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string
  value: string | number
  subtext?: string
  accent?: 'green'
}) {
  const valueColor = accent === 'green' ? 'var(--green)' : 'var(--text)'
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <p style={{ color: 'var(--text3)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
          fontSize: '1.5rem',
          fontWeight: 600,
          marginTop: '4px',
          color: valueColor,
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </p>
      {subtext && <p style={{ color: 'var(--text3)', fontSize: '0.72rem', marginTop: '4px' }}>{subtext}</p>}
    </div>
  )
}

function BidRow({ bid, onClick }: { bid: Bid; onClick: () => void }) {
  const clients = [...new Set((bid.line_items ?? []).map((li) => li.client).filter(Boolean))]
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 hover:bg-muted/60 transition-colors border-b last:border-b-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{bid.project_name}</p>
          {clients.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{clients.join(', ')}</p>
          )}
          {bid.estimator_name && (
            <p className="text-xs text-muted-foreground">{bid.estimator_name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASSES[bid.status]}`}
          >
            {bid.status}
          </span>
          {bid.total_price != null && bid.total_price > 0 && (
            <span className="text-xs font-semibold">{formatCurrency(bid.total_price)}</span>
          )}
        </div>
      </div>
      {bid.bid_due_date && (
        <p className={`text-xs mt-1 ${dueDateClass(bid.bid_due_date)}`}>
          Due {new Date(bid.bid_due_date + 'T00:00:00').toLocaleDateString()}
        </p>
      )}
    </button>
  )
}

function SortableHeader({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  col: SortKey
  label: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
}) {
  const active = col === sortKey
  return (
    <th className="text-right">
      <button
        onClick={() => onSort(col)}
        className={`text-xs font-semibold uppercase tracking-wide px-3 py-2 w-full text-right transition-colors ${
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
        {active && <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    </th>
  )
}

export function BranchManagerDashboard() {
  const { stats, recentBids, estimatorBreakdown, loading, error } = useDashboard()
  const { openBid } = useBidDetail()
  const { branches: userBranches } = useUserRole()

  const [activeBranch, setActiveBranch] = useState<Branch | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('pipelineValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg p-4 h-24 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
            ))}
          </div>
          <div className="rounded-lg h-64 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
        </div>
        <div className="rounded-lg h-40 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-card">
        Failed to load dashboard: {error}
      </div>
    )
  }

  const filteredRecent =
    activeBranch === 'All'
      ? recentBids
      : recentBids.filter((b) => b.branch === activeBranch)

  const bidsDueThisWeek =
    activeBranch === 'All'
      ? (stats?.bidsDueThisWeek ?? [])
      : (stats?.bidsDueThisWeek ?? []).filter((b) => b.branch === activeBranch)

  const sortedEstimators = [...estimatorBreakdown].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDir === 'desc' ? -diff : diff
  })

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      {/* Left / Main column */}
      <div className="space-y-6 min-w-0">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Active Bids"
            value={stats?.activeCount ?? 0}
            subtext="Bidding + In Progress"
          />
          <MetricCard
            label="Sent"
            value={stats?.sentCount ?? 0}
            subtext="Awaiting decision"
          />
          <MetricCard
            label="Awarded"
            value={stats?.awardedCount ?? 0}
            accent="green"
          />
          <MetricCard
            label="Pipeline Value"
            value={formatCurrency(stats?.pipelineValue ?? 0)}
            subtext="Active bids total"
          />
        </div>

        {/* Branch toggle (only if multiple branches) */}
        {userBranches.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setActiveBranch('All')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 150ms ease',
                background: activeBranch === 'All' ? 'linear-gradient(135deg, #38bdf8, #0ea5e9)' : 'var(--surface2)',
                color: activeBranch === 'All' ? 'white' : 'var(--text2)',
                border: activeBranch === 'All' ? 'none' : '1px solid var(--border)',
                boxShadow: activeBranch === 'All' ? '0 4px 14px rgba(56,189,248,0.35)' : 'none',
                cursor: 'pointer',
              }}
            >
              All Branches
            </button>
            {userBranches.map((b) => (
              <button
                key={b}
                onClick={() => setActiveBranch(b)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 150ms ease',
                  background: activeBranch === b ? 'linear-gradient(135deg, #38bdf8, #0ea5e9)' : 'var(--surface2)',
                  color: activeBranch === b ? 'white' : 'var(--text2)',
                  border: activeBranch === b ? 'none' : '1px solid var(--border)',
                  boxShadow: activeBranch === b ? '0 4px 14px rgba(56,189,248,0.35)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {BRANCH_LABELS[b] ?? b}
              </button>
            ))}
          </div>
        )}

        {/* Recent Bids */}
        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Recent Bids</h2>
          </div>
          <div>
            {filteredRecent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No bids found.</p>
            ) : (
              filteredRecent.map((bid) => (
                <BidRow key={bid.id} bid={bid} onClick={() => openBid(bid)} />
              ))
            )}
          </div>
        </div>

        {/* Estimator Performance */}
        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Estimator Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Name
                  </th>
                  <SortableHeader col="activeBids" label="Active" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="sentCount" label="Sent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="awardedCount" label="Awarded" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="pipelineValue" label="Pipeline" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedEstimators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      No estimator data.
                    </td>
                  </tr>
                ) : (
                  sortedEstimators.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium text-sm">{e.name}</td>
                      <td className="px-3 py-2 text-right text-sm">{e.activeBids}</td>
                      <td className="px-3 py-2 text-right text-sm">{e.sentCount}</td>
                      <td className="px-3 py-2 text-right text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {e.awardedCount}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold">
                        {formatCurrency(e.pipelineValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bids Due This Week */}
        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Bids Due This Week</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Active bids due in the next 7 days</p>
          </div>
          <div>
            {bidsDueThisWeek.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No bids due this week.</p>
            ) : (
              bidsDueThisWeek.map((bid) => (
                <BidRow key={bid.id} bid={bid} onClick={() => openBid(bid)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <TodoList />
      </div>
    </div>
  )
}
