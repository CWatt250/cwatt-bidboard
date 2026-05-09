'use client'

import type { Bid } from '@/hooks/useBids'
import { CalendarDays, Clock, Send, TrendingUp } from 'lucide-react'

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `$${Math.round(val / 1_000)}K`
  return `$${Math.round(val)}`
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

interface KpiCardProps {
  label: string
  count?: number
  value: number
  compact?: boolean
  trend?: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
}

function KpiCard({ label, count, value, compact, trend, icon, iconBg, iconColor }: KpiCardProps) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 500, marginBottom: 3, whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          {compact ? (
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              {formatCompact(value)}
            </span>
          ) : (
            <>
              {count !== undefined && (
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                  {count}
                </span>
              )}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', lineHeight: 1 }}>
                {formatCurrency(value)}
              </span>
            </>
          )}
          {trend !== undefined && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: trend >= 0 ? '#059669' : '#ef4444',
              }}
            >
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface KpiRowProps {
  bids: Bid[]
}

export function KpiRow({ bids }: KpiRowProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Current calendar week, Sunday → Saturday (matches kanban week filter)
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  // Bids visible on the kanban board: Unassigned shows current week + future
  // (or no due date); other statuses show only current week. Mirrors the
  // filter logic on the workspace page so KPIs reflect what the user sees.
  const boardBids = bids.filter((b) => {
    if (b.status === 'Unassigned') {
      if (!b.bid_due_date) return true
      const d = new Date(b.bid_due_date + 'T00:00:00')
      return d >= startOfWeek
    }
    if (!b.bid_due_date) return false
    const d = new Date(b.bid_due_date + 'T00:00:00')
    return d >= startOfWeek && d <= endOfWeek
  })

  // Due Today
  const dueTodayBids = bids.filter((b) => {
    if (!b.bid_due_date) return false
    const d = new Date(b.bid_due_date + 'T00:00:00')
    return d.getTime() === today.getTime()
  })
  const dueTodayValue = dueTodayBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Due This Week (Sunday through Saturday of current calendar week, all statuses)
  const dueWeekBids = bids.filter((b) => {
    if (!b.bid_due_date) return false
    const d = new Date(b.bid_due_date + 'T00:00:00')
    return d >= startOfWeek && d <= endOfWeek
  })
  const dueWeekValue = dueWeekBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Sent status — only bids currently on the board
  const sentBids = boardBids.filter((b) => b.status === 'Sent')
  const sentValue = sentBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Total Bid Value — sum across all bids currently on the board
  const weekValue = boardBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  return (
    <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
      <KpiCard
        label="Due Today"
        count={dueTodayBids.length}
        value={dueTodayValue}
        icon={<CalendarDays size={18} />}
        iconBg="rgba(220,38,38,0.1)"
        iconColor="#dc2626"
      />
      <KpiCard
        label="Due This Week"
        count={dueWeekBids.length}
        value={dueWeekValue}
        icon={<Clock size={18} />}
        iconBg="rgba(234,88,12,0.1)"
        iconColor="#ea580c"
      />
      <KpiCard
        label="Sent"
        count={sentBids.length}
        value={sentValue}
        icon={<Send size={18} />}
        iconBg="rgba(59,130,246,0.1)"
        iconColor="#3b82f6"
      />
      <KpiCard
        label="Total Bid Value (Week)"
        value={weekValue}
        compact
        icon={<TrendingUp size={18} />}
        iconBg="rgba(5,150,105,0.1)"
        iconColor="#059669"
      />
    </div>
  )
}
