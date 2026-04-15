'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboard } from '@/hooks/useDashboard'
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  STATUS_BADGE_CLASSES,
  BRANCH_BADGE_CLASSES,
} from '@/config/colors'
import { BRANCH_LABELS, getBidClientName } from '@/lib/supabase/types'
import type { Bid, BidScope, Branch, BidStatus } from '@/lib/supabase/types'

// ─── types ──────────────────────────────────────────────────────────────────

export type TimeRange = 'this-month' | 'this-quarter' | 'this-year' | 'all-time'

type TrendWeeks = 4 | 8 | 12
type BranchMetric = 'Pipeline' | 'Awarded'

// ─── helpers ───────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatCurrencyFull(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function getTimeRangeStart(range: TimeRange): string | null {
  if (range === 'all-time') return null
  const now = new Date()
  if (range === 'this-month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  if (range === 'this-quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3
    return `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`
  }
  if (range === 'this-year') {
    return `${now.getFullYear()}-01-01`
  }
  return null
}

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

// ─── card shell ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-lg, var(--radius))',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '0.5px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text)',
}

// ─── SegmentedControl ───────────────────────────────────────────────────────

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'white',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        padding: '2px',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            padding: '3px 10px',
            borderRadius: '6px',
            border:
              value === opt.value
                ? '0.5px solid var(--border)'
                : '0.5px solid transparent',
            background: value === opt.value ? 'var(--surface2)' : 'transparent',
            color: value === opt.value ? 'var(--text)' : 'var(--text3)',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
            lineHeight: 1.5,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string | number
  subtext?: string
}) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '16px' }}>
        <p
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
            fontSize: '1.6rem',
            fontWeight: 500,
            marginTop: '6px',
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {subtext && (
          <p
            style={{
              color: 'var(--text3)',
              fontSize: '0.72rem',
              marginTop: '5px',
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Active Pipeline bar chart (CSS bars) ──────────────────────────────────

const PIPELINE_STAGES: { status: string; color: string }[] = [
  { status: 'In Progress', color: '#378ADD' },
  { status: 'Sent',        color: '#185FA5' },
  { status: 'Awarded',     color: '#639922' },
  { status: 'Lost',        color: '#E24B4A' },
]

function ActivePipelineChart({ bids }: { bids: Bid[] }) {
  const stageTotals = PIPELINE_STAGES.map(({ status, color }) => {
    const total = bids
      .filter((b) => b.status === status)
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0)
    return { status, color, total }
  })

  const maxVal = Math.max(...stageTotals.map((s) => s.total), 1)

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {stageTotals.map(({ status, color, total }) => {
        const pct = Math.round((total / maxVal) * 100)
        return (
          <div key={status}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '5px',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text2)', fontWeight: 500 }}>
                {status}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text)',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {formatCurrency(total)}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '5px',
                background: 'var(--surface2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: '5px',
                  background: color,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Pipeline Trend line chart ──────────────────────────────────────────────

function getPipelineTrendData(bids: Bid[], weeks: TrendWeeks) {
  const now = new Date()
  const buckets: { label: string; weekStart: Date; weekEnd: Date }[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const month = weekStart.toLocaleString('default', { month: 'short' })
    const day = weekStart.getDate()
    buckets.push({ label: `${month} ${day}`, weekStart, weekEnd })
  }

  return buckets.map(({ label, weekStart, weekEnd }) => {
    const activeBids = bids.filter((b) => {
      if (b.status === 'Lost') return false
      const updatedAt = new Date(b.updated_at)
      return updatedAt >= weekStart && updatedAt <= weekEnd
    })
    const value = activeBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)
    return { label, value }
  })
}

function PipelineTrendChart({ bids, weeks }: { bids: Bid[]; weeks: TrendWeeks }) {
  const data = useMemo(() => getPipelineTrendData(bids, weeks), [bids, weeks])

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v) => [formatCurrencyFull(Number(v)), 'Pipeline']}
            contentStyle={{
              fontSize: '11px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#trendGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Branch Performance ─────────────────────────────────────────────────────

function BranchPerformanceChart({
  bids,
  metric,
}: {
  bids: Bid[]
  metric: BranchMetric
}) {
  const breakdown = useMemo(() => {
    return ALL_BRANCHES.map((branch) => {
      const branchBids = bids.filter((b) => b.branch === branch)
      const pipelineBids = branchBids.filter(
        (b) => b.status === 'Bidding' || b.status === 'In Progress' || b.status === 'Sent'
      )
      const awardedBids = branchBids.filter((b) => b.status === 'Awarded')
      const value =
        metric === 'Pipeline'
          ? pipelineBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)
          : awardedBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)
      const activeCount = branchBids.filter(
        (b) => b.status === 'Bidding' || b.status === 'In Progress'
      ).length
      return { branch, value, activeCount }
    })
  }, [bids, metric])

  const maxValue = Math.max(...breakdown.map((b) => b.value), 1)

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {breakdown.map((item) => {
        const pct = Math.round((item.value / maxValue) * 100)
        return (
          <div key={item.branch}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '5px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className={`inline-flex items-center px-1.5 py-0 rounded text-xs border ${BRANCH_BADGE_CLASSES[item.branch] ?? ''}`}
                >
                  {item.branch}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                  {BRANCH_LABELS[item.branch]}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                  {item.activeCount} active
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    fontFamily: '"IBM Plex Mono", monospace',
                  }}
                >
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '5px',
                background: 'var(--surface2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: '5px',
                  background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Revenue by Scope donut chart ───────────────────────────────────────────

const SCOPE_CHART_COLORS: Record<string, string> = {
  'HVAC Piping':     '#378ADD',
  'HVAC Ductwork':   '#60a5fa',
  'Plumbing Piping': '#639922',
  'Fire Stopping':   '#f59e0b',
  'Equipment':       '#a855f7',
  'Other':           '#9ca3af',
}

function RevenueByScope({ bids }: { bids: Bid[] }) {
  const awardedBids = bids.filter((b) => b.status === 'Awarded')

  const scopeMap = new Map<string, number>()
  for (const bid of awardedBids) {
    for (const li of bid.line_items ?? []) {
      const prev = scopeMap.get(li.scope) ?? 0
      scopeMap.set(li.scope, prev + (bid.total_price ?? 0))
    }
  }

  const data = Array.from(scopeMap.entries())
    .map(([scope, value]) => ({ scope, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text3)', textAlign: 'center', paddingTop: 24 }}>
          No awarded bids yet.
        </p>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const CustomLegend = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
      {data.map((d) => (
        <div key={d.scope} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: SCOPE_CHART_COLORS[d.scope] ?? '#9ca3af',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', flex: 1 }}>{d.scope}</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              fontFamily: '"IBM Plex Mono", monospace',
              color: 'var(--text)',
            }}
          >
            {formatCurrency(d.value)}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ padding: '8px 16px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flexShrink: 0, width: 160 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="scope"
              cx="50%"
              cy="50%"
              outerRadius={72}
              innerRadius={44}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.scope}
                  fill={SCOPE_CHART_COLORS[entry.scope] ?? '#9ca3af'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [formatCurrencyFull(Number(v))]}
              contentStyle={{
                fontSize: '11px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text3)',
            marginTop: '-8px',
          }}
        >
          Total: {formatCurrency(total)}
        </p>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CustomLegend />
      </div>
    </div>
  )
}

// ─── Recent Bids table (full width) ─────────────────────────────────────────

function getDueDateBadge(
  dueDateStr: string | null | undefined
): { label: string; bg: string; color: string } | null {
  if (!dueDateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return null
  const label = `${diff}d`
  if (diff <= 2) return { label, bg: '#FCEBEB', color: '#A32D2D' }
  if (diff <= 5) return { label, bg: '#FAEEDA', color: '#854F0B' }
  return { label, bg: '#EAF3DE', color: '#3B6D11' }
}

const BID_STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']

function RecentBidsTable({
  bids,
  statusFilter,
  branchFilter,
}: {
  bids: Bid[]
  statusFilter: string
  branchFilter: string
}) {
  const router = useRouter()

  const filtered = useMemo(() => {
    let result = bids
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter)
    if (branchFilter !== 'all') result = result.filter((b) => b.branch === branchFilter)
    return result.slice(0, 8)
  }, [bids, statusFilter, branchFilter])

  if (filtered.length === 0) {
    return (
      <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text3)' }}>
        No bids found.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface2)' }}>
            {['Project Name', 'Client', 'Bid Value', 'Status', 'Due'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '8px 14px',
                  textAlign: 'left',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((bid) => {
            const clientNames = (bid.clients ?? [])
              .map(getBidClientName)
              .filter(Boolean)
            const clientDisplay =
              clientNames.length === 0
                ? '—'
                : clientNames.length === 1
                  ? clientNames[0]
                  : `${clientNames[0]} +${clientNames.length - 1}`
            const dueBadge = getDueDateBadge(bid.bid_due_date)
            return (
              <tr
                key={bid.id}
                onClick={() => router.push(`/dashboard/bids/${bid.id}`)}
                style={{
                  borderBottom: '0.5px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = ''
                }}
              >
                <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: 260 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bid.project_name}
                  </span>
                </td>
                <td
                  style={{
                    padding: '10px 14px',
                    color: 'var(--text3)',
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clientDisplay}
                </td>
                <td
                  style={{
                    padding: '10px 14px',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bid.total_price ? formatCurrency(bid.total_price) : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASSES[bid.status]}`}
                  >
                    {bid.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {dueBadge ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: dueBadge.bg,
                        color: dueBadge.color,
                      }}
                    >
                      {dueBadge.label}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── AdminDashboard ─────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: '6px',
  border: '0.5px solid var(--border)',
  background: 'white',
  color: 'var(--text)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'auto',
}

export function AdminDashboard({ timeRange = 'this-month' }: { timeRange?: TimeRange }) {
  const { allBids, loading, error } = useDashboard()

  // Step 2: Pipeline trend range
  const [trendWeeks, setTrendWeeks] = useState<TrendWeeks>(8)

  // Step 3: Branch metric toggle
  const [branchMetric, setBranchMetric] = useState<BranchMetric>('Pipeline')

  // Step 4: Recent bids filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')

  // Filter allBids by global timeRange (for charts + KPIs)
  const filteredBids = useMemo(() => {
    const start = getTimeRangeStart(timeRange)
    if (!start) return allBids
    return allBids.filter((b) => b.updated_at >= start)
  }, [allBids, timeRange])

  if (loading) {
    return (
      <div className="space-y-3">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: 96, ...cardStyle }}
            />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="animate-pulse" style={{ height: 220, ...cardStyle }} />
          <div className="animate-pulse" style={{ height: 220, ...cardStyle }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="animate-pulse" style={{ height: 220, ...cardStyle }} />
          <div className="animate-pulse" style={{ height: 220, ...cardStyle }} />
        </div>
        <div className="animate-pulse" style={{ height: 280, ...cardStyle }} />
      </div>
    )
  }

  if (error) {
    return <div className="error-card">Failed to load dashboard: {error}</div>
  }

  // ── KPI calculations (from filteredBids) ────────────────────────────────
  const totalSecuredValue = filteredBids
    .filter((b) => b.status === 'Awarded')
    .reduce((sum, b) => sum + (b.total_price ?? 0), 0)
  const totalSecuredJobs = filteredBids.filter((b) => b.status === 'Awarded').length

  const openBidsCount = filteredBids.filter(
    (b) => b.status === 'Bidding' || b.status === 'In Progress'
  ).length

  const sentCount = filteredBids.filter((b) => b.status === 'Sent').length

  const awardedCount = filteredBids.filter((b) => b.status === 'Awarded').length
  const lostCount = filteredBids.filter((b) => b.status === 'Lost').length
  const winRateDenominator = awardedCount + lostCount
  const winRate =
    winRateDenominator > 0
      ? Math.round((awardedCount / winRateDenominator) * 100)
      : null

  const timeRangeLabel =
    timeRange === 'this-month' ? 'This Month'
    : timeRange === 'this-quarter' ? 'This Quarter'
    : timeRange === 'this-year' ? 'This Year'
    : 'All Time'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Row 1: KPI cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard
          label="Total Secured"
          value={formatCurrency(totalSecuredValue)}
          subtext={`${totalSecuredJobs} jobs · ${timeRangeLabel}`}
        />
        <KpiCard
          label="Open Bids"
          value={openBidsCount}
          subtext="Bidding + In Progress"
        />
        <KpiCard
          label="Bids Sent"
          value={sentCount}
          subtext={timeRangeLabel}
        />
        <KpiCard
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          subtext={`${awardedCount}W / ${lostCount}L · ${timeRangeLabel}`}
        />
      </div>

      {/* ── Row 2: Active Pipeline + Pipeline Trend ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>Active Pipeline</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>
                Total bid value by stage
              </p>
            </div>
          </div>
          <ActivePipelineChart bids={filteredBids} />
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>Pipeline Trend</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>
                Active bid value — last {trendWeeks} weeks
              </p>
            </div>
            <SegmentedControl<TrendWeeks>
              options={[
                { label: '4W', value: 4 },
                { label: '8W', value: 8 },
                { label: '12W', value: 12 },
              ]}
              value={trendWeeks}
              onChange={setTrendWeeks}
            />
          </div>
          <PipelineTrendChart bids={filteredBids} weeks={trendWeeks} />
        </div>
      </div>

      {/* ── Row 3: Branch Performance + Revenue by Scope ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>Branch Performance</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>
                {branchMetric === 'Pipeline' ? 'Pipeline value' : 'Awarded value'} by branch
              </p>
            </div>
            <SegmentedControl<BranchMetric>
              options={[
                { label: 'Pipeline', value: 'Pipeline' },
                { label: 'Awarded', value: 'Awarded' },
              ]}
              value={branchMetric}
              onChange={setBranchMetric}
            />
          </div>
          <BranchPerformanceChart bids={filteredBids} metric={branchMetric} />
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>Revenue by Scope</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>
                Awarded bids grouped by scope
              </p>
            </div>
          </div>
          <RevenueByScope bids={filteredBids} />
        </div>
      </div>

      {/* ── Row 4: Recent Bids ───────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <p style={cardTitleStyle}>Recent Bids</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>
              Up to 8 bids, sorted by last updated
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <select
              style={selectStyle}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {BID_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">All Branches</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
        <RecentBidsTable
          bids={allBids}
          statusFilter={statusFilter}
          branchFilter={branchFilter}
        />
      </div>
    </div>
  )
}
