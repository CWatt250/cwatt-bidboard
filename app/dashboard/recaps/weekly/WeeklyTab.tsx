'use client'

import { useMemo, useState } from 'react'
import { format, subDays, isValid, startOfWeek } from 'date-fns'
import { useRecapData } from '@/hooks/useRecapData'
import {
  atRiskBids,
  bidTotalValue,
  bidsInWeek,
  branchBreakdownThisWeek,
  securedInWeek,
  verbalsInWeek,
  weekRange,
} from '@/lib/recap-aggregations'
import { AtRiskCallout } from './AtRiskCallout'
import { BidsTable } from './BidsTable'
import { QuickTotalsRail } from './QuickTotalsRail'

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

export function WeeklyTab() {
  const { bids, loading, error } = useRecapData()

  // The week the user is reviewing. Defaults to "this week" (the Monday-Sunday
  // containing today). All downstream ranges hang off this anchor.
  const [anchor, setAnchor] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )

  const thisWeek = useMemo(() => weekRange(anchor), [anchor])
  const lastWeek = useMemo(() => weekRange(subDays(anchor, 7)), [anchor])

  const lastWeekBids = useMemo(
    () => bidsInWeek(bids, lastWeek.start, lastWeek.end),
    [bids, lastWeek],
  )
  const thisWeekBids = useMemo(
    () => bidsInWeek(bids, thisWeek.start, thisWeek.end),
    [bids, thisWeek],
  )

  const lastWeekTotals = useMemo(
    () => ({ count: lastWeekBids.length, total: bidTotalValue(lastWeekBids) }),
    [lastWeekBids],
  )
  const thisWeekTotals = useMemo(
    () => ({ count: thisWeekBids.length, total: bidTotalValue(thisWeekBids) }),
    [thisWeekBids],
  )

  const securedLastWeek = useMemo(
    () => securedInWeek(bids, lastWeek.start, lastWeek.end),
    [bids, lastWeek],
  )
  const verbalsLastWeek = useMemo(
    () => verbalsInWeek(bids, lastWeek.start, lastWeek.end),
    [bids, lastWeek],
  )
  const branchBreakdown = useMemo(
    () => branchBreakdownThisWeek(bids, thisWeek.start, thisWeek.end),
    [bids, thisWeek],
  )
  const atRisk = useMemo(() => atRiskBids(bids, new Date()), [bids])

  const lastWeekSentCount = lastWeekBids.filter((b) => b.status === 'Sent').length
  const thisWeekSentCount = thisWeekBids.filter((b) => b.status === 'Sent').length

  const headerRange = `${format(lastWeek.start, 'MMM d')} – ${format(lastWeek.end, 'MMM d')} vs ${format(thisWeek.start, 'MMM d')} – ${format(thisWeek.end, 'MMM d')}`
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
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
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text3)',
              marginTop: 2,
            }}
          >
            {headerRange}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            Week of
          </label>
          <input
            type="date"
            value={toYmd(thisWeek.start)}
            onChange={(e) => {
              const parsed = parseYmd(e.target.value)
              if (parsed) {
                setAnchor(startOfWeek(parsed, { weekStartsOn: 1 }))
              }
            }}
            style={{
              height: 32,
              padding: '0 8px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.8rem',
            }}
          />
        </div>
      </div>

      {/* At-risk callout */}
      <AtRiskCallout summary={atRisk} />

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
            emptyMessage="No bids were due last week."
          />
          <BidsTable
            title="Bids due this week"
            subtitle={`${thisRangeLabel} · ${thisWeekTotals.count} bid${thisWeekTotals.count === 1 ? '' : 's'} · ${formatCurrency(thisWeekTotals.total)} · ${thisWeekSentCount} sent`}
            bids={thisWeekBids}
            emptyMessage="No bids are due this week."
          />
        </div>
        <QuickTotalsRail
          lastWeek={lastWeekTotals}
          thisWeek={thisWeekTotals}
          secured={securedLastWeek}
          verbals={verbalsLastWeek}
          branchBreakdown={branchBreakdown}
        />
      </div>

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
