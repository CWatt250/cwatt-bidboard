'use client'

import { BRANCH_BADGE_CLASSES } from '@/config/colors'
import type { BranchBreakdownItem, WeekTotals } from '@/lib/recap-aggregations'

interface QuickTotalsRailProps {
  lastWeek: { count: number; total: number }
  thisWeek: { count: number; total: number }
  secured: WeekTotals
  verbals: WeekTotals
  branchBreakdown: BranchBreakdownItem[]
  /** When true, drops position: sticky so the rail flows inline (used in Meeting Mode). */
  inline?: boolean
  scale?: number
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function MiniCard({
  label,
  total,
  count,
  delta,
  scale,
}: {
  label: string
  total: number
  count: number
  delta?: number | null
  scale: number
}) {
  const deltaPositive = delta != null && delta > 0
  const deltaNegative = delta != null && delta < 0
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        boxShadow: 'var(--shadow-sm)',
        padding: `${14 * scale}px ${16 * scale}px`,
      }}
    >
      <p
        style={{
          fontSize: `${10 * scale}px`,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
          fontSize: `${22 * scale}px`,
          fontWeight: 500,
          marginTop: `${6 * scale}px`,
          color: 'var(--text)',
          letterSpacing: '-0.4px',
          lineHeight: 1,
        }}
      >
        {formatCurrency(total)}
      </p>
      <p
        style={{
          color: 'var(--text3)',
          fontSize: `${11 * scale}px`,
          marginTop: `${5 * scale}px`,
          display: 'flex',
          alignItems: 'center',
          gap: `${6 * scale}px`,
        }}
      >
        <span>
          {count} bid{count === 1 ? '' : 's'}
        </span>
        {delta != null && (
          <span
            style={{
              fontWeight: 600,
              color: deltaPositive ? '#10b981' : deltaNegative ? '#ef4444' : 'var(--text3)',
            }}
          >
            {deltaPositive ? '+' : ''}{delta}% vs last
          </span>
        )}
      </p>
    </div>
  )
}

function BranchBar({
  item,
  maxTotal,
  scale,
}: {
  item: BranchBreakdownItem
  maxTotal: number
  scale: number
}) {
  const pct = maxTotal > 0 ? Math.round((item.total / maxTotal) * 100) : 0
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: `${5 * scale}px`,
          gap: `${8 * scale}px`,
        }}
      >
        <span
          className={`inline-flex items-center px-1.5 py-0 rounded border ${BRANCH_BADGE_CLASSES[item.branch] ?? ''}`}
          style={{ fontSize: `${10 * scale}px` }}
        >
          {item.branch}
        </span>
        <span style={{ flex: 1, fontSize: `${10 * scale}px`, color: 'var(--text3)' }}>
          {item.count} bid{item.count === 1 ? '' : 's'}
        </span>
        <span
          style={{
            fontSize: `${11 * scale}px`,
            fontWeight: 500,
            fontFamily: '"IBM Plex Mono", monospace',
            color: 'var(--text)',
          }}
        >
          {formatCurrency(item.total)}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: `${8 * scale}px`,
          borderRadius: `${4 * scale}px`,
          background: 'var(--surface2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: `${4 * scale}px`,
            background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
            transition: 'width 300ms ease',
          }}
        />
      </div>
    </div>
  )
}

export function QuickTotalsRail({
  lastWeek,
  thisWeek,
  secured,
  verbals,
  branchBreakdown,
  inline = false,
  scale = 1,
}: QuickTotalsRailProps) {
  const maxBranchTotal = Math.max(...branchBreakdown.map((b) => b.total), 1)
  const delta = percentDelta(thisWeek.total, lastWeek.total)

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${12 * scale}px`,
        position: inline ? 'static' : 'sticky',
        top: inline ? undefined : 80,
      }}
    >
      <MiniCard
        label="Due last week"
        total={lastWeek.total}
        count={lastWeek.count}
        scale={scale}
      />
      <MiniCard
        label="Due this week"
        total={thisWeek.total}
        count={thisWeek.count}
        delta={delta}
        scale={scale}
      />
      <MiniCard
        label="Secured last week"
        total={secured.total}
        count={secured.count}
        scale={scale}
      />
      <MiniCard
        label="Verbals last week"
        total={verbals.total}
        count={verbals.count}
        scale={scale}
      />

      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg, var(--radius))',
          boxShadow: 'var(--shadow-sm)',
          padding: `${14 * scale}px ${16 * scale}px`,
        }}
      >
        <p
          style={{
            fontSize: `${10 * scale}px`,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
            marginBottom: `${10 * scale}px`,
          }}
        >
          By branch · this week
        </p>
        {branchBreakdown.every((b) => b.count === 0) ? (
          <p style={{ fontSize: `${11 * scale}px`, color: 'var(--text3)' }}>
            No bids scheduled this week.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${10 * scale}px` }}>
            {branchBreakdown.map((item) => (
              <BranchBar key={item.branch} item={item} maxTotal={maxBranchTotal} scale={scale} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
