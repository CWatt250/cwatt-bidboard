'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts'
import {
  startOfMonth,
  startOfQuarter,
  startOfYear,
  startOfWeek,
  endOfWeek,
  subMonths,
  subQuarters,
  subYears,
  subWeeks,
  isWithinInterval,
  format,
} from 'date-fns'
import { useDashboard } from '@/hooks/useDashboard'
import { useUserRole } from '@/contexts/userRole'
import { AnimNum } from './AnimNum'
import { useTooltip, FloatingTooltip } from '@/hooks/useTooltip'
import {
  DARK_STATUS_COLORS,
  DARK_BRANCH_COLORS,
  SCOPE_CHART_COLORS,
} from '@/config/colors'
import { BRANCH_LABELS, getBidClientName } from '@/lib/supabase/types'
import type { Bid, BidStatus, Branch } from '@/lib/supabase/types'

export type TimeRange = 'this-month' | 'this-quarter' | 'this-year' | 'all-time'

type TrendWeeks = 4 | 8 | 12
type BranchMetric = 'Pipeline' | 'Awarded'

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const BID_STATUSES: BidStatus[] = [
  'Unassigned', 'Bidding', 'In Progress', 'Sent', 'Verbal', 'Awarded', 'Lost',
]

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Month', value: 'this-month' },
  { label: 'Quarter', value: 'this-quarter' },
  { label: 'Year', value: 'this-year' },
  { label: 'All time', value: 'all-time' },
]

const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  'this-month': 'This Month',
  'this-quarter': 'This Quarter',
  'this-year': 'This Year',
  'all-time': 'All Time',
}

// ─── helpers ────────────────────────────────────────────────────────────────

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

function formatCount(value: number): string {
  return Math.round(value).toLocaleString()
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

interface DateWindow {
  start: Date | null
  end: Date | null
}

/** [start, end] of the current time window. all-time returns null bounds. */
function currentWindow(range: TimeRange, now: Date): DateWindow {
  if (range === 'all-time') return { start: null, end: null }
  if (range === 'this-month') return { start: startOfMonth(now), end: now }
  if (range === 'this-quarter') return { start: startOfQuarter(now), end: now }
  return { start: startOfYear(now), end: now }
}

/** Same-length window shifted back one period. all-time has no prior. */
function priorWindow(range: TimeRange, now: Date): DateWindow {
  if (range === 'all-time') return { start: null, end: null }
  if (range === 'this-month') {
    const priorNow = subMonths(now, 1)
    return { start: startOfMonth(priorNow), end: priorNow }
  }
  if (range === 'this-quarter') {
    const priorNow = subQuarters(now, 1)
    return { start: startOfQuarter(priorNow), end: priorNow }
  }
  const priorNow = subYears(now, 1)
  return { start: startOfYear(priorNow), end: priorNow }
}

function inWindow(date: Date | null | undefined, window: DateWindow): boolean {
  if (!date) return false
  if (!window.start || !window.end) return true
  return date.getTime() >= window.start.getTime() && date.getTime() <= window.end.getTime()
}

function bidDueDate(b: Bid): Date | null {
  if (!b.bid_due_date) return null
  return new Date(b.bid_due_date + 'T00:00:00')
}

/** Effective awarded date — MAX flagged-line-item awarded_at, else bid_due_date. */
function bidAwardedAt(b: Bid): Date | null {
  let max: number | null = null
  for (const li of b.line_items ?? []) {
    if (!li.is_awarded || !li.awarded_at) continue
    const t = new Date(li.awarded_at).getTime()
    if (max == null || t > max) max = t
  }
  if (max != null) return new Date(max)
  return bidDueDate(b)
}

/** Sum the bid's awarded line-item prices. Falls back to total_price if no flags. */
function bidAwardedValue(b: Bid): number {
  const flagged = (b.line_items ?? []).filter((li) => li.is_awarded)
  if (flagged.length === 0) return b.total_price ?? 0
  return flagged.reduce((sum, li) => sum + (li.price ?? 0), 0)
}

function pctDelta(current: number, prior: number): number | null {
  if (prior <= 0) return null
  return ((current - prior) / prior) * 100
}

// ─── KPI computations ──────────────────────────────────────────────────────

interface KpiMetric {
  value: number
  prior: number
  delta: number | null
  subtext: string
  sparkline: number[]
}

function lastNWeekRanges(n: number, now: Date): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const anchor = subWeeks(now, i)
    out.push({
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    })
  }
  return out
}

function computeSecuredKpi(bids: Bid[], range: TimeRange, now: Date): KpiMetric {
  const current = currentWindow(range, now)
  const prior = priorWindow(range, now)
  let value = 0
  let prevValue = 0
  let count = 0
  for (const b of bids) {
    if (b.status !== 'Awarded') continue
    const ymd = bidAwardedAt(b)
    if (!ymd) continue
    if (inWindow(ymd, current)) {
      value += bidAwardedValue(b)
      count++
    } else if (inWindow(ymd, prior)) {
      prevValue += bidAwardedValue(b)
    }
  }
  const sparkline = lastNWeekRanges(8, now).map(({ start, end }) => {
    let total = 0
    for (const b of bids) {
      if (b.status !== 'Awarded') continue
      const ymd = bidAwardedAt(b)
      if (!ymd) continue
      if (isWithinInterval(ymd, { start, end })) {
        total += bidAwardedValue(b)
      }
    }
    return total
  })
  return {
    value,
    prior: prevValue,
    delta: pctDelta(value, prevValue),
    subtext: `${count} job${count === 1 ? '' : 's'} · ${TIME_RANGE_LABEL[range]}`,
    sparkline,
  }
}

function computeOpenKpi(bids: Bid[], range: TimeRange, now: Date): KpiMetric {
  const current = currentWindow(range, now)
  const prior = priorWindow(range, now)
  const isOpen = (s: BidStatus) => s === 'Bidding' || s === 'In Progress'
  let value = 0
  let prevValue = 0
  for (const b of bids) {
    if (!isOpen(b.status)) continue
    const due = bidDueDate(b)
    if (inWindow(due, current)) value++
    else if (inWindow(due, prior)) prevValue++
  }
  const sparkline = lastNWeekRanges(8, now).map(({ start, end }) => {
    let n = 0
    for (const b of bids) {
      if (!isOpen(b.status)) continue
      const due = bidDueDate(b)
      if (due && isWithinInterval(due, { start, end })) n++
    }
    return n
  })
  return {
    value,
    prior: prevValue,
    delta: pctDelta(value, prevValue),
    subtext: 'Bidding + In Progress',
    sparkline,
  }
}

function computeSentKpi(bids: Bid[], range: TimeRange, now: Date): KpiMetric {
  const current = currentWindow(range, now)
  const prior = priorWindow(range, now)
  let value = 0
  let prevValue = 0
  for (const b of bids) {
    if (b.status !== 'Sent') continue
    const updated = b.updated_at ? new Date(b.updated_at) : null
    if (inWindow(updated, current)) value++
    else if (inWindow(updated, prior)) prevValue++
  }
  const sparkline = lastNWeekRanges(8, now).map(({ start, end }) => {
    let n = 0
    for (const b of bids) {
      if (b.status !== 'Sent') continue
      const updated = b.updated_at ? new Date(b.updated_at) : null
      if (updated && isWithinInterval(updated, { start, end })) n++
    }
    return n
  })
  return {
    value,
    prior: prevValue,
    delta: pctDelta(value, prevValue),
    subtext: TIME_RANGE_LABEL[range],
    sparkline,
  }
}

// Pinned YTD Secured — always current calendar year, line-item-level.
// Mirrors the logic shipped in commit aaec501:
//   • Only Awarded or Verbal parent bids contribute (guards against stale
//     is_awarded flags on Lost/active rows).
//   • If any line_item is flagged is_awarded, count only the flagged ones;
//     otherwise count every line item on the bid (status-only flagging path).
//   • A line item lands in YTD when its awarded_at year matches the current
//     calendar year, falling back to the parent bid_due_date year when
//     awarded_at is null (pre-feature rows).
//   • Subtitle count is distinct bids that contributed at least one line item.
interface YtdSecuredResult {
  value: number
  jobCount: number
  year: number
  sparkline: number[]
}

function computeYtdSecured(orgBids: Bid[], now: Date): YtdSecuredResult {
  const ytdYear = now.getFullYear()
  const ytdYearStr = String(ytdYear)
  const ytdBidIds = new Set<string>()
  const monthlyBuckets = new Array(12).fill(0)
  let ytdSecuredValue = 0

  for (const b of orgBids) {
    if (b.status !== 'Awarded' && b.status !== 'Verbal') continue
    const lineItems = b.line_items ?? []
    const anyFlagged = lineItems.some((li) => li.is_awarded)
    const surviving = anyFlagged ? lineItems.filter((li) => li.is_awarded) : lineItems
    for (const li of surviving) {
      let inYear = false
      let monthIdx = -1
      if (li.awarded_at) {
        const d = new Date(li.awarded_at)
        inYear = d.getFullYear() === ytdYear && d <= now
        monthIdx = d.getMonth()
      } else if (b.bid_due_date) {
        inYear = b.bid_due_date.startsWith(ytdYearStr) && new Date(b.bid_due_date) <= now
        monthIdx = parseInt(b.bid_due_date.slice(5, 7), 10) - 1
      }
      if (!inYear) continue
      const price = li.price ?? 0
      ytdSecuredValue += price
      ytdBidIds.add(b.id)
      if (monthIdx >= 0 && monthIdx < 12) monthlyBuckets[monthIdx] += price
    }
  }

  // Cumulative running total from January through the current month — shows
  // growth over the year so far. Capped at 8 points to match the small cards.
  const currentMonth = now.getMonth()
  const startMonth = Math.max(0, currentMonth - 7)
  const sparkline: number[] = []
  let running = 0
  for (let m = 0; m < startMonth; m++) running += monthlyBuckets[m]
  for (let m = startMonth; m <= currentMonth; m++) {
    running += monthlyBuckets[m]
    sparkline.push(running)
  }

  return {
    value: ytdSecuredValue,
    jobCount: ytdBidIds.size,
    year: ytdYear,
    sparkline,
  }
}

interface WinRateKpi extends KpiMetric {
  wins: number
  decided: number
}

function computeWinRateKpi(bids: Bid[], range: TimeRange, now: Date): WinRateKpi {
  const current = currentWindow(range, now)
  const prior = priorWindow(range, now)
  let wins = 0
  let losses = 0
  let priorWins = 0
  let priorLosses = 0
  for (const b of bids) {
    const updated = b.updated_at ? new Date(b.updated_at) : null
    if (b.status === 'Awarded') {
      if (inWindow(updated, current)) wins++
      else if (inWindow(updated, prior)) priorWins++
    } else if (b.status === 'Lost') {
      if (inWindow(updated, current)) losses++
      else if (inWindow(updated, prior)) priorLosses++
    }
  }
  const decided = wins + losses
  const priorDecided = priorWins + priorLosses
  const value = decided > 0 ? (wins / decided) * 100 : 0
  const prevValue = priorDecided > 0 ? (priorWins / priorDecided) * 100 : 0
  const sparkline = lastNWeekRanges(8, now).map(({ start, end }) => {
    let w = 0
    let l = 0
    for (const b of bids) {
      const updated = b.updated_at ? new Date(b.updated_at) : null
      if (!updated || !isWithinInterval(updated, { start, end })) continue
      if (b.status === 'Awarded') w++
      else if (b.status === 'Lost') l++
    }
    return w + l > 0 ? (w / (w + l)) * 100 : 0
  })
  return {
    value,
    prior: prevValue,
    delta: pctDelta(value, prevValue),
    subtext: `${wins}/${decided} decided`,
    sparkline,
    wins,
    decided,
  }
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({
  values,
  color,
  width = 80,
  height = 28,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  const W = width
  const H = height
  const padding = 2
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const n = values.length
  const stepX = (W - padding * 2) / Math.max(n - 1, 1)
  const points = values.map((v, i) => {
    const x = padding + i * stepX
    const y = padding + (1 - (v - min) / span) * (H - padding * 2)
    return { x, y }
  })
  if (points.length === 0) return null
  const last = points[points.length - 1]
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const areaD =
    `M${points[0].x.toFixed(2)},${H - padding} ` +
    points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') +
    ` L${last.x.toFixed(2)},${H - padding} Z`
  const gradId = `spark-${color.replace('#', '')}`
  return (
    <svg width={W} height={H} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={lineD} stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  )
}

// ─── KPI card ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  accent: string
  value: number
  format: (n: number) => string
  subtext: string
  delta: number | null
  sparkline: number[]
}

function KpiCard({ label, accent, value, format, subtext, delta, sparkline }: KpiCardProps) {
  const positive = delta != null && delta > 0
  const negative = delta != null && delta < 0
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: 18,
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, ${accent}00)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          background: `radial-gradient(circle, ${accent}26 0%, ${accent}00 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--dash-text3)',
          }}
        >
          {label}
        </p>
        <Sparkline values={sparkline} color={accent} />
      </div>
      <AnimNum
        value={value}
        format={format}
        style={{
          display: 'block',
          fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: '-0.7px',
          color: 'var(--dash-text)',
          lineHeight: 1,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 10,
          fontSize: 11,
          color: 'var(--dash-text3)',
        }}
      >
        <span>{subtext}</span>
        {delta != null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              background: positive
                ? 'rgba(52, 211, 153, 0.14)'
                : negative
                  ? 'rgba(251, 113, 133, 0.14)'
                  : 'rgba(125, 138, 186, 0.14)',
              color: positive ? '#34d399' : negative ? '#fb7185' : 'var(--dash-text3)',
            }}
          >
            <span aria-hidden="true">{positive ? '▲' : negative ? '▼' : '—'}</span>
            {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Pipeline bar chart ────────────────────────────────────────────────────

const PIPELINE_BAR_STATUSES: BidStatus[] = ['Sent', 'Awarded', 'Lost', 'In Progress']

interface PipelineBarDatum {
  status: BidStatus
  value: number
  count: number
  color: string
}

interface PipelineBarTooltipProps {
  active?: boolean
  payload?: Array<{ payload: PipelineBarDatum }>
}

function PipelineBarTooltip({ active, payload }: PipelineBarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const { status, value, count, color } = payload[0].payload
  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--dash-text)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        <span style={{ fontWeight: 600 }}>{status}</span>
      </div>
      <div
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          color: 'var(--dash-text3)',
        }}
      >
        {count} bid{count === 1 ? '' : 's'} · {formatCurrencyFull(value)}
      </div>
    </div>
  )
}

function PipelineBarChart({ bids }: { bids: Bid[] }) {
  const data = useMemo<PipelineBarDatum[]>(() => {
    return PIPELINE_BAR_STATUSES.map((status) => {
      const matching = bids.filter((b) => b.status === status)
      return {
        status,
        value: matching.reduce((sum, b) => sum + (b.total_price ?? 0), 0),
        count: matching.length,
        color: DARK_STATUS_COLORS[status],
      }
    })
  }, [bids])

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AnimNum
        value={total}
        format={formatCurrencyFull}
        style={{
          fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
          fontSize: 22,
          fontWeight: 500,
          color: 'var(--dash-text)',
          letterSpacing: '-0.4px',
        }}
      />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="status"
              tick={{ fontSize: 10.5, fill: '#7d8aba', fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#7d8aba', fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickCount={5}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
              content={<PipelineBarTooltip />}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              isAnimationActive
              animationDuration={600}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Pipeline Trend ─────────────────────────────────────────────────────────

function buildTrendBuckets(bids: Bid[], weeks: TrendWeeks, now: Date) {
  const ranges = lastNWeekRanges(weeks, now)
  return ranges.map(({ start, end }) => {
    const matching = bids.filter((b) => {
      if (b.status === 'Lost' || b.status === 'Awarded') return false
      const due = bidDueDate(b)
      if (!due) return false
      return isWithinInterval(due, { start, end })
    })
    const value = matching.reduce((sum, b) => sum + (b.total_price ?? 0), 0)
    return {
      label: format(end, 'MMM d'),
      value,
      count: matching.length,
      end,
    }
  })
}

function PipelineTrend({ bids, now }: { bids: Bid[]; now: Date }) {
  const [weeks, setWeeks] = useState<TrendWeeks>(8)
  const data = useMemo(() => buildTrendBuckets(bids, weeks, now), [bids, weeks, now])
  const tickCount = data.length
  const tickInterval = tickCount > 1 ? Math.floor((tickCount - 1) / 2) : 0
  const ticks = tickCount > 0 ? [data[0].label, data[tickInterval]?.label, data[tickCount - 1].label].filter(Boolean) : []
  const currentValue = data.length > 0 ? data[data.length - 1].value : 0
  const priorValue = data.length > 1 ? data[data.length - 2].value : 0
  const delta = pctDelta(currentValue, priorValue)
  const positive = delta != null && delta > 0
  const negative = delta != null && delta < 0

  return (
    <div
      style={{
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'var(--dash-text3)',
            }}
          >
            Pipeline Trend
          </p>
          <p style={{ fontSize: 11, color: 'var(--dash-text3)', marginTop: 2 }}>
            Active bid value · last {weeks} weeks
          </p>
        </div>
        <DarkSegmented<TrendWeeks>
          value={weeks}
          options={[
            { label: '4W', value: 4 },
            { label: '8W', value: 8 },
            { label: '12W', value: 12 },
          ]}
          onChange={setWeeks}
        />
      </header>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <AnimNum
          value={currentValue}
          format={formatCurrencyFull}
          style={{
            fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--dash-text)',
            letterSpacing: '-0.4px',
          }}
        />
        {delta != null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              background: positive
                ? 'rgba(52, 211, 153, 0.14)'
                : negative
                  ? 'rgba(251, 113, 133, 0.14)'
                  : 'rgba(125, 138, 186, 0.14)',
              color: positive ? '#34d399' : negative ? '#fb7185' : 'var(--dash-text3)',
            }}
          >
            <span aria-hidden="true">{positive ? '▲' : negative ? '▼' : '—'}</span>
            {Math.abs(Math.round(delta))}% vs prior
          </span>
        )}
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <filter id="dash-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.6" />
              </filter>
            </defs>
            <XAxis
              dataKey="label"
              ticks={ticks}
              tick={{ fontSize: 10, fill: '#7d8aba', fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#7d8aba', fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickCount={5}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#38bdf8"
              strokeWidth={0.9}
              fill="url(#dash-area)"
              dot={{ r: 0.7, fill: '#38bdf8', stroke: 'none' }}
              activeDot={{ r: 1.2, fill: '#38bdf8', stroke: 'none' }}
              style={{ filter: 'url(#dash-glow)' }}
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Branch Performance ─────────────────────────────────────────────────────

function BranchPerformance({ bids }: { bids: Bid[] }) {
  const [metric, setMetric] = useState<BranchMetric>('Pipeline')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setProgress(1)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1)
      return
    }
    setProgress(0)
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 700)
      const eased = 1 - Math.pow(1 - p, 3)
      setProgress(eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [bids, metric])

  const rows = useMemo(() => {
    const isPipeline = (s: BidStatus) =>
      s === 'Bidding' || s === 'In Progress' || s === 'Sent'
    return ALL_BRANCHES.map((branch) => {
      const branchBids = bids.filter((b) => b.branch === branch)
      const pipelineBids = branchBids.filter((b) => isPipeline(b.status))
      const awardedBids = branchBids.filter((b) => b.status === 'Awarded')
      const value =
        metric === 'Pipeline'
          ? pipelineBids.reduce((s, b) => s + (b.total_price ?? 0), 0)
          : awardedBids.reduce((s, b) => s + bidAwardedValue(b), 0)
      const activeCount = branchBids.filter(
        (b) => b.status === 'Bidding' || b.status === 'In Progress',
      ).length
      return { branch, value, activeCount, color: DARK_BRANCH_COLORS[branch] ?? '#38bdf8' }
    }).sort((a, b) => b.value - a.value)
  }, [bids, metric])

  const maxValue = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div
      style={{
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'var(--dash-text3)',
            }}
          >
            Branch Performance
          </p>
          <p style={{ fontSize: 11, color: 'var(--dash-text3)', marginTop: 2 }}>
            {metric === 'Pipeline' ? 'Pipeline value' : 'Awarded value'} by branch
          </p>
        </div>
        <DarkSegmented<BranchMetric>
          value={metric}
          options={[
            { label: 'Pipeline', value: 'Pipeline' },
            { label: 'Awarded', value: 'Awarded' },
          ]}
          onChange={setMetric}
        />
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, idx) => {
          const target = Math.round((row.value / maxValue) * 100)
          const stagger = Math.min(1, Math.max(0, progress - idx * 0.1) / 0.9)
          const pct = Math.round(target * stagger)
          return (
            <div key={row.branch}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 5,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: `${row.color}22`,
                      color: row.color,
                      border: `1px solid ${row.color}44`,
                    }}
                  >
                    {row.branch}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--dash-text3)' }}>
                    {BRANCH_LABELS[row.branch]}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--dash-text3)' }}>
                    {row.activeCount} active
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: '"IBM Plex Mono", monospace',
                      color: 'var(--dash-text)',
                      fontWeight: 500,
                    }}
                  >
                    {formatCurrency(row.value)}
                  </span>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.04)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${row.color}, ${row.color}aa)`,
                    boxShadow: `0 0 10px ${row.color}55`,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Revenue by Scope donut ─────────────────────────────────────────────────

interface ScopeSlice {
  scope: string
  value: number
  color: string
}

function RevenueByScope({ bids }: { bids: Bid[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const { state: tipState, show: showTip, hide: hideTip } = useTooltip()

  const slices = useMemo<ScopeSlice[]>(() => {
    const map = new Map<string, number>()
    for (const b of bids) {
      if (b.status !== 'Awarded') continue
      for (const li of b.line_items ?? []) {
        if (!li.is_awarded) continue
        const prev = map.get(li.scope) ?? 0
        map.set(li.scope, prev + (li.price ?? 0))
      }
    }
    return Array.from(map.entries())
      .map(([scope, value]) => ({ scope, value, color: SCOPE_CHART_COLORS[scope] ?? '#9ca3af' }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [bids])

  useEffect(() => {
    if (typeof window === 'undefined') {
      setProgress(slices.length)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(slices.length)
      return
    }
    setProgress(0)
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const elapsed = now - start
      const target = Math.min(slices.length, elapsed / 80)
      setProgress(target)
      if (target < slices.length) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [slices])

  const total = slices.reduce((sum, s) => sum + s.value, 0)

  // Donut arc geometry
  const cx = 80
  const cy = 80
  const outerR = 64
  const innerR = 42

  function describeSlice(startAngle: number, endAngle: number): string {
    const x1 = cx + outerR * Math.cos(startAngle)
    const y1 = cy + outerR * Math.sin(startAngle)
    const x2 = cx + outerR * Math.cos(endAngle)
    const y2 = cy + outerR * Math.sin(endAngle)
    const x3 = cx + innerR * Math.cos(endAngle)
    const y3 = cy + innerR * Math.sin(endAngle)
    const x4 = cx + innerR * Math.cos(startAngle)
    const y4 = cy + innerR * Math.sin(startAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  let acc = -Math.PI / 2

  return (
    <div
      style={{
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--dash-text3)',
          }}
        >
          Revenue by Scope
        </p>
        <p style={{ fontSize: 11, color: 'var(--dash-text3)', marginTop: 2 }}>
          Awarded line-item value grouped by scope
        </p>
      </header>
      {slices.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--dash-text3)', padding: '24px 0' }}>
          No awarded scopes yet.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
            <svg width={160} height={160}>
              {slices.map((slice, idx) => {
                const angle = (slice.value / total) * Math.PI * 2
                const startA = acc
                const endA = acc + angle
                acc = endA
                const dim = hovered != null && hovered !== slice.scope
                const reveal = Math.min(1, Math.max(0, progress - idx))
                if (reveal <= 0) return null
                return (
                  <path
                    key={slice.scope}
                    d={describeSlice(startA, endA)}
                    fill={slice.color}
                    style={{
                      opacity: dim ? 0.35 : reveal,
                      transform: hovered === slice.scope ? 'scale(1.04)' : 'scale(1)',
                      transformOrigin: `${cx}px ${cy}px`,
                      filter: hovered === slice.scope ? `drop-shadow(0 0 8px ${slice.color})` : 'none',
                      transition: 'opacity 200ms ease, transform 200ms ease, filter 200ms ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      setHovered(slice.scope)
                      showTip(
                        `${slice.scope} · ${formatCurrencyFull(slice.value)} · ${((slice.value / total) * 100).toFixed(1)}%`,
                        e.clientX,
                        e.clientY,
                      )
                    }}
                    onMouseMove={(e) =>
                      showTip(
                        `${slice.scope} · ${formatCurrencyFull(slice.value)} · ${((slice.value / total) * 100).toFixed(1)}%`,
                        e.clientX,
                        e.clientY,
                      )
                    }
                    onMouseLeave={() => {
                      setHovered(null)
                      hideTip()
                    }}
                  />
                )
              })}
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--dash-text3)',
                }}
              >
                Awarded
              </span>
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--dash-text)',
                  marginTop: 2,
                }}
              >
                {formatCurrency(total)}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {slices.map((slice) => (
              <div
                key={slice.scope}
                onMouseEnter={() => setHovered(slice.scope)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  opacity: hovered != null && hovered !== slice.scope ? 0.45 : 1,
                  transition: 'opacity 200ms ease',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: slice.color,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--dash-text2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {slice.scope}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: 'var(--dash-text)' }}>
                  {formatCurrency(slice.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <FloatingTooltip state={tipState} />
    </div>
  )
}

// ─── Recent Bids ────────────────────────────────────────────────────────────

function dueChip(dueDateStr: string | null | undefined, now: Date): { label: string; bg: string; color: string } | null {
  if (!dueDateStr) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return null
  const label = `${diff}d`
  if (diff <= 2) return { label, bg: 'rgba(239, 68, 68, 0.18)', color: '#fb7185' }
  if (diff <= 5) return { label, bg: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24' }
  return { label, bg: 'rgba(16, 185, 129, 0.18)', color: '#34d399' }
}

function RecentBids({ bids, now }: { bids: Bid[]; now: Date }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let result = bids
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter)
    if (branchFilter !== 'all') result = result.filter((b) => b.branch === branchFilter)
    return result.slice(0, 8)
  }, [bids, statusFilter, branchFilter])

  const selectStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--dash-text)',
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '5px 22px 5px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237d8aba' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  }

  return (
    <div
      style={{
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: 18,
          borderBottom: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'var(--dash-text3)',
            }}
          >
            Recent Bids
          </p>
          <p style={{ fontSize: 11, color: 'var(--dash-text3)', marginTop: 2 }}>
            Up to 8 bids · sorted by last updated
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            {BID_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by branch"
          >
            <option value="all">All Branches</option>
            {ALL_BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </header>
      {filtered.length === 0 ? (
        <p style={{ padding: 24, fontSize: 12, color: 'var(--dash-text3)', textAlign: 'center' }}>
          No bids match the current filters.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--dash-border)' }}>
                {['Project', 'Branch', 'Client', 'Bid Value', 'Status', 'Due'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: h === 'Bid Value' ? 'right' : 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--dash-text3)',
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
                const clientNames = (bid.clients ?? []).map(getBidClientName).filter(Boolean)
                const clientDisplay =
                  clientNames.length === 0
                    ? '—'
                    : clientNames.length === 1
                      ? clientNames[0]
                      : `${clientNames[0]} +${clientNames.length - 1}`
                const due = dueChip(bid.bid_due_date, now)
                const statusColor = DARK_STATUS_COLORS[bid.status]
                const branchColor = DARK_BRANCH_COLORS[bid.branch] ?? '#38bdf8'
                return (
                  <tr
                    key={bid.id}
                    onClick={() => router.push(`/dashboard/bids/${bid.id}`)}
                    style={{
                      borderBottom: '1px solid var(--dash-border)',
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.02)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        color: 'var(--dash-text)',
                        fontWeight: 500,
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={bid.project_name}
                    >
                      {bid.project_name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: `${branchColor}22`,
                          color: branchColor,
                          border: `1px solid ${branchColor}44`,
                        }}
                      >
                        {bid.branch}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        color: 'var(--dash-text2)',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={clientNames.join(', ') || undefined}
                    >
                      {clientDisplay}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontFamily: '"IBM Plex Mono", monospace',
                        fontWeight: 500,
                        color: 'var(--dash-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {bid.total_price ? formatCurrency(bid.total_price) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${statusColor}26`,
                          color: statusColor,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: statusColor,
                            boxShadow: `0 0 6px ${statusColor}`,
                          }}
                        />
                        {bid.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {due ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: due.bg,
                            color: due.color,
                          }}
                        >
                          {due.label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--dash-text3)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Segmented control (dark) ───────────────────────────────────────────────

function DarkSegmented<T extends string | number>({
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
      role="tablist"
      style={{
        display: 'inline-flex',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 999,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: 999,
              border: 'none',
              background: active ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
              color: active ? '#38bdf8' : 'var(--dash-text3)',
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Pinned YTD Secured row ─────────────────────────────────────────────────

function PinnedYtdRow({ data }: { data: YtdSecuredResult }) {
  const accent = 'var(--kpi-secured)'
  const accentHex = '#34d399'
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--dash-card)',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: '22px 24px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accentHex}, ${accentHex}00)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          background: `radial-gradient(circle, ${accentHex}26 0%, ${accentHex}00 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--dash-text3)',
            marginBottom: 10,
          }}
        >
          Total Secured This Year
        </p>
        <AnimNum
          value={data.value}
          format={formatCurrencyFull}
          style={{
            display: 'block',
            fontFamily: '"IBM Plex Mono", var(--font-mono), monospace',
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: '-0.9px',
            color: 'var(--dash-text)',
            lineHeight: 1,
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--dash-text3)', marginTop: 12 }}>
          {data.jobCount} job{data.jobCount === 1 ? '' : 's'} · year to date
        </p>
      </div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: `${accentHex}22`,
            color: accent,
            border: `1px solid ${accentHex}44`,
            letterSpacing: '0.08em',
          }}
        >
          {data.year}
        </span>
        {data.sparkline.length >= 2 && (
          <Sparkline values={data.sparkline} color={accentHex} width={160} height={40} />
        )}
      </div>
    </div>
  )
}

// ─── AdminDashboard root ────────────────────────────────────────────────────

export function AdminDashboard() {
  const { allBids, orgBids, loading, error } = useDashboard()
  const { profile } = useUserRole()
  const [timeRange, setTimeRange] = useState<TimeRange>('this-month')

  const now = useMemo(() => new Date(), [])

  // Filter personal allBids by the global time range. The window applies to
  // bid_due_date — when a bid is "happening" — to match the existing pattern.
  const filteredBids = useMemo(() => {
    const window = currentWindow(timeRange, now)
    if (!window.start) return allBids
    const startMs = window.start.getTime()
    return allBids.filter((b) => {
      const due = bidDueDate(b)
      return due != null && due.getTime() >= startMs
    })
  }, [allBids, timeRange, now])

  const securedKpi = useMemo(
    () => computeSecuredKpi(allBids, timeRange, now),
    [allBids, timeRange, now],
  )
  // Pinned YTD Secured row — always current calendar year, line-item-level,
  // org-wide. Ignores the active time-range filter.
  const ytdSecured = useMemo(() => computeYtdSecured(orgBids, now), [orgBids, now])
  const openKpi = useMemo(
    () => computeOpenKpi(allBids, timeRange, now),
    [allBids, timeRange, now],
  )
  const sentKpi = useMemo(
    () => computeSentKpi(allBids, timeRange, now),
    [allBids, timeRange, now],
  )
  const winKpi = useMemo(
    () => computeWinRateKpi(allBids, timeRange, now),
    [allBids, timeRange, now],
  )

  const firstName = useMemo(() => {
    const n = profile?.name ?? ''
    return n.split(/\s+/)[0] || 'Admin'
  }, [profile])

  if (error) {
    return (
      <div className="dash-shell">
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#fb7185',
          }}
        >
          Failed to load dashboard: {error}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="dash-shell">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="animate-pulse" style={{ height: 60, borderRadius: 12, background: 'var(--dash-card)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{ height: 130, borderRadius: 14, background: 'var(--dash-card)' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
            <div className="animate-pulse" style={{ height: 320, borderRadius: 14, background: 'var(--dash-card)' }} />
            <div className="animate-pulse" style={{ height: 320, borderRadius: 14, background: 'var(--dash-card)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-shell">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ── Page header ─────────────────────────────────────────── */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#38bdf8',
                textTransform: 'uppercase',
              }}
            >
              BidWatt · Command Center
            </p>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--dash-text)',
                letterSpacing: '-0.6px',
                marginTop: 6,
              }}
            >
              Welcome back, {firstName}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--dash-text3)', marginTop: 4 }}>
              {TIME_RANGE_LABEL[timeRange]} · 5 branches · {format(now, 'MMM d, yyyy')}
            </p>
          </div>
          <DarkSegmented<TimeRange>
            value={timeRange}
            options={TIME_RANGE_OPTIONS}
            onChange={setTimeRange}
          />
        </header>

        {/* ── Row 1: Pinned YTD Secured (always current calendar year) ── */}
        <PinnedYtdRow data={ytdSecured} />

        {/* ── Row 2: KPI strip (respects the time-range filter) ────── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <KpiCard
            label="Total Secured"
            accent="#34d399"
            value={securedKpi.value}
            format={formatCurrencyFull}
            subtext={securedKpi.subtext}
            delta={securedKpi.delta}
            sparkline={securedKpi.sparkline}
          />
          <KpiCard
            label="Open Bids"
            accent="#38bdf8"
            value={openKpi.value}
            format={formatCount}
            subtext={openKpi.subtext}
            delta={openKpi.delta}
            sparkline={openKpi.sparkline}
          />
          <KpiCard
            label="Bids Sent"
            accent="#a78bfa"
            value={sentKpi.value}
            format={formatCount}
            subtext={sentKpi.subtext}
            delta={sentKpi.delta}
            sparkline={sentKpi.sparkline}
          />
          <KpiCard
            label="Win Rate"
            accent="#fbbf24"
            value={winKpi.value}
            format={formatPercent}
            subtext={winKpi.subtext}
            delta={winKpi.delta}
            sparkline={winKpi.sparkline}
          />
        </section>

        {/* ── Row 2: Active Pipeline + Pipeline Trend ─────────────── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              background: 'var(--dash-card)',
              border: '1px solid var(--dash-border)',
              borderRadius: 14,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <header>
              <p
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'var(--dash-text3)',
                }}
              >
                Active Pipeline
              </p>
              <p style={{ fontSize: 11, color: 'var(--dash-text3)', marginTop: 2 }}>
                Bid value by stage
              </p>
            </header>
            <PipelineBarChart bids={filteredBids} />
          </div>
          <PipelineTrend bids={filteredBids} now={now} />
        </section>

        {/* ── Row 3: Branch Performance + Revenue by Scope ────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <BranchPerformance bids={orgBids} />
          <RevenueByScope bids={orgBids} />
        </section>

        {/* ── Row 4: Recent Bids ──────────────────────────────────── */}
        <RecentBids bids={allBids} now={now} />
      </div>
    </div>
  )
}
