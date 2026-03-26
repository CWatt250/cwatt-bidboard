'use client'

import { useDashboard } from '@/hooks/useDashboard'
import { useBidDetail } from '@/contexts/bidDetail'
import { TodoList } from '@/components/workspace/TodoList'
import { STATUS_BADGE_CLASSES, DUE_DATE_URGENT_CLASS, DUE_DATE_WARNING_CLASS } from '@/config/colors'
import type { Bid } from '@/lib/supabase/types'

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
  accent?: 'green' | 'default'
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
  const clients = [
    ...new Set((bid.line_items ?? []).map((li) => li.client).filter(Boolean)),
  ]
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 rounded-md hover:bg-muted/60 transition-colors border-b last:border-b-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{bid.project_name}</p>
          {clients.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{clients.join(', ')}</p>
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

export function EstimatorDashboard() {
  const { stats, recentBids, loading, error } = useDashboard()
  const { openBid } = useBidDetail()

  if (loading) {
    return (
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg p-4 h-24 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
            ))}
          </div>
          <div className="rounded-lg p-4 h-64 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
        </div>
        <div className="rounded-lg p-4 h-40 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }} />
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

  const bidsDueThisWeek = stats?.bidsDueThisWeek ?? []

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

        {/* Recent Bids */}
        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Recent Bids</h2>
          </div>
          <div className="divide-y">
            {recentBids.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No bids found.
              </p>
            ) : (
              recentBids.map((bid) => (
                <BidRow key={bid.id} bid={bid} onClick={() => openBid(bid)} />
              ))
            )}
          </div>
        </div>

        {/* Bids Due This Week */}
        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Bids Due This Week</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Active bids due in the next 7 days</p>
          </div>
          <div className="divide-y">
            {bidsDueThisWeek.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No bids due this week.
              </p>
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
