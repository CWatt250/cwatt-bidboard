'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { useBidDetail } from '@/contexts/bidDetail'
import {
  STATUS_BADGE_CLASSES,
  BRANCH_BADGE_CLASSES,
  DUE_DATE_URGENT_CLASS,
  DUE_DATE_WARNING_CLASS,
} from '@/config/colors'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import type { Bid, BidScope, Branch } from '@/lib/supabase/types'
import type { EstimatorBreakdown } from '@/hooks/useDashboard'

type SortKey = keyof Pick<EstimatorBreakdown, 'activeBids' | 'sentCount' | 'awardedCount' | 'pipelineValue'>

const SCOPE_COLORS: Record<BidScope, string> = {
  'Plumbing Piping': '#3b82f6',
  'HVAC Piping':     '#06b6d4',
  'HVAC Ductwork':   '#f97316',
  'Fire Stopping':   '#ef4444',
  'Equipment':       '#a855f7',
  'Other':           '#6b7280',
}

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
  accent?: 'green' | 'blue'
}) {
  const valueColor =
    accent === 'green'
      ? 'var(--green)'
      : accent === 'blue'
      ? 'var(--accent2)'
      : 'var(--text)'
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
          <div className="flex items-center gap-2 mt-0.5">
            {bid.estimator_name && (
              <p className="text-xs text-muted-foreground">{bid.estimator_name}</p>
            )}
            <span
              className={`inline-flex items-center px-1.5 py-0 rounded text-xs border ${BRANCH_BADGE_CLASSES[bid.branch] ?? ''}`}
            >
              {bid.branch}
            </span>
          </div>
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

function BranchPerformanceChart({
  branchBreakdown,
}: {
  branchBreakdown: { branch: Branch; pipelineValue: number; activeCount: number }[]
}) {
  const maxValue = Math.max(...branchBreakdown.map((b) => b.pipelineValue), 1)
  return (
    <div className="space-y-3">
      {branchBreakdown.map((item) => {
        const pct = Math.round((item.pipelineValue / maxValue) * 100)
        return (
          <div key={item.branch}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-1.5 py-0 rounded text-xs border ${BRANCH_BADGE_CLASSES[item.branch] ?? ''}`}
                >
                  {item.branch}
                </span>
                <span className="text-xs text-muted-foreground">{BRANCH_LABELS[item.branch]}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-right">
                <span className="text-muted-foreground">{item.activeCount} active</span>
                <span className="font-semibold">{formatCurrency(item.pipelineValue)}</span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScopeDonut({
  scopeBreakdown,
}: {
  scopeBreakdown: { scope: BidScope; count: number }[]
}) {
  const total = scopeBreakdown.reduce((s, i) => s + i.count, 0)
  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No active bids.</p>
  }

  let cumulative = 0
  const segments = scopeBreakdown.map((item) => {
    const pct = (item.count / total) * 100
    const start = cumulative
    cumulative += pct
    return { ...item, start, pct }
  })

  const gradient = segments
    .map((s) => `${SCOPE_COLORS[s.scope]} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`)
    .join(', ')

  return (
    <div className="flex items-center gap-6">
      <div className="shrink-0 relative w-28 h-28">
        <div
          className="w-28 h-28 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        {/* Donut hole */}
        <div className="absolute inset-0 m-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
          <span className="text-xs font-semibold">{total}</span>
        </div>
      </div>
      <div className="space-y-1.5 min-w-0">
        {segments.map((s) => (
          <div key={s.scope} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: SCOPE_COLORS[s.scope] }}
            />
            <span className="text-xs text-muted-foreground truncate">{s.scope}</span>
            <span className="text-xs font-medium ml-auto pl-2">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
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

export function AdminDashboard() {
  const { stats, recentBids, branchBreakdown, estimatorBreakdown, scopeBreakdown, loading, error } =
    useDashboard()
  const { openBid } = useBidDetail()

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
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border rounded-lg p-4 h-24 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg h-64 animate-pulse" />
            <div className="bg-card border rounded-lg h-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg h-64 animate-pulse" />
            <div className="bg-card border rounded-lg h-64 animate-pulse" />
          </div>
        </div>
        <div className="bg-card border rounded-lg h-40 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load dashboard: {error}
      </div>
    )
  }

  const sortedEstimators = [...estimatorBreakdown].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDir === 'desc' ? -diff : diff
  })

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      {/* Main bento area */}
      <div className="space-y-6 min-w-0">
        {/* Top row — 6 metric cards in 3×2 grid */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            label="Total Pipeline Value"
            value={formatCurrency(stats?.pipelineValue ?? 0)}
            subtext="Active bids"
          />
          <MetricCard
            label="Active Bids"
            value={stats?.activeCount ?? 0}
            subtext="Bidding + In Progress"
          />
          <MetricCard
            label="Sent This Month"
            value={stats?.sentThisMonth ?? 0}
            subtext="Status updated this month"
          />
          <MetricCard
            label="Awarded YTD"
            value={stats?.awardedYTD ?? 0}
            accent="green"
            subtext="Year to date"
          />
          <MetricCard
            label="Bids Due This Week"
            value={stats?.bidsDueThisWeek.length ?? 0}
            accent="blue"
            subtext="Next 7 days"
          />
          <MetricCard
            label="Estimators Active"
            value={stats?.totalActiveEstimators ?? 0}
            subtext="Active accounts"
          />
        </div>

        {/* Middle row — Branch Performance + Recent Bids */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Branch Performance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pipeline value by branch</p>
            </div>
            <div className="p-4">
              {branchBreakdown.every((b) => b.pipelineValue === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-4">No active bids.</p>
              ) : (
                <BranchPerformanceChart branchBreakdown={branchBreakdown} />
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Recent Bids</h2>
            </div>
            <div>
              {recentBids.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No bids found.</p>
              ) : (
                recentBids.map((bid) => (
                  <BidRow key={bid.id} bid={bid} onClick={() => openBid(bid)} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom row — Estimator Leaderboard + Scope Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Estimator Leaderboard</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sorted by pipeline value</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Branch
                    </th>
                    <SortableHeader col="activeBids" label="Active" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHeader col="sentCount" label="Sent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHeader col="awardedCount" label="Won" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHeader col="pipelineValue" label="Pipeline" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedEstimators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        No estimator data.
                      </td>
                    </tr>
                  ) : (
                    sortedEstimators.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium text-sm">{e.name}</td>
                        <td className="px-3 py-2">
                          {e.branch ? (
                            <span
                              className={`inline-flex items-center px-1.5 py-0 rounded text-xs border ${BRANCH_BADGE_CLASSES[e.branch] ?? ''}`}
                            >
                              {e.branch}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
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

          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Scope Breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Active bids by scope</p>
            </div>
            <div className="p-4">
              <ScopeDonut scopeBreakdown={scopeBreakdown} />
            </div>
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-1">To-Do List</h2>
          <p className="text-xs text-muted-foreground">Coming in Phase 6G</p>
        </div>
      </div>
    </div>
  )
}
