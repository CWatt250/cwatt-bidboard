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

  const in7 = new Date(today)
  in7.setDate(in7.getDate() + 7)

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Due Today
  const dueTodayBids = bids.filter((b) => {
    if (!b.bid_due_date) return false
    const d = new Date(b.bid_due_date + 'T00:00:00')
    return d.getTime() === today.getTime()
  })
  const dueTodayValue = dueTodayBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Due This Week (today through +7 days)
  const dueWeekBids = bids.filter((b) => {
    if (!b.bid_due_date) return false
    const d = new Date(b.bid_due_date + 'T00:00:00')
    return d >= today && d <= in7
  })
  const dueWeekValue = dueWeekBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Sent status
  const sentBids = bids.filter((b) => b.status === 'Sent')
  const sentValue = sentBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  // Total Bid Value this week (bids updated in last 7 days)
  const weekBids = bids.filter((b) => new Date(b.updated_at) >= weekAgo)
  const weekValue = weekBids.reduce((s, b) => s + (b.total_price ?? 0), 0)

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
        trend={8.4}
        icon={<TrendingUp size={18} />}
        iconBg="rgba(5,150,105,0.1)"
        iconColor="#059669"
      />
    </div>
  )
}
