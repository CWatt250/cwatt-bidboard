'use client'

import type { BranchMonthlyStats, BundledStats } from '@/lib/recap-aggregations'
import { BRANCH_LABELS } from '@/lib/supabase/types'

interface MonthlyReportProps {
  stats: BranchMonthlyStats[]
  month: number
  year: number
  bundleMode: boolean
  bundled: BundledStats | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    const formatted = Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(value / 1_000)
    return `$${formatted}K`
  }
  return Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
        {fmt(value)}
      </span>
    </div>
  )
}

export function MonthlyReport({
  stats,
  month,
  year,
  bundleMode,
  bundled,
}: MonthlyReportProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: '1.05rem',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.2px',
          marginBottom: 16,
        }}
      >
        {MONTH_NAMES[month - 1]} {year} Recap
      </h2>

      {bundleMode && bundled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text3)',
              padding: '2px 0 6px',
              borderBottom: '0.5px solid var(--border)',
              marginBottom: 4,
            }}
          >
            All Branches Combined
          </div>
          <StatRow label="Bids Submitted" value={bundled.submitted} />
          <StatRow label="Total Bid Value" value={bundled.totalValue} />
          <StatRow label="Total Secured" value={bundled.secured} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stats.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text3)',
                textAlign: 'center',
                padding: 24,
              }}
            >
              No branch data for this month.
            </p>
          )}
          {stats.map((s) => (
            <div key={s.branch}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text3)',
                  padding: '2px 0 6px',
                  borderBottom: '0.5px solid var(--border)',
                  marginBottom: 4,
                }}
              >
                {BRANCH_LABELS[s.branch]} (#{s.branch === 'PSC' ? 467 : s.branch === 'SEA' ? 466 : s.branch === 'POR' ? 465 : s.branch === 'PHX' ? 462 : s.branch === 'SLC' ? 468 : ''})
              </div>
              <StatRow label="Bids Submitted" value={s.submitted} />
              <StatRow label="Total Bid Value" value={s.totalValue} />
              <StatRow label="Total Secured" value={s.secured} />
            </div>
          ))}

          {stats.length >= 2 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text)',
                  padding: '2px 0 6px',
                }}
              >
                Combined
              </div>
              <StatRow
                label="Bids Submitted"
                value={stats.reduce((sum, s) => sum + s.submitted, 0)}
              />
              <StatRow
                label="Total Bid Value"
                value={stats.reduce((sum, s) => sum + s.totalValue, 0)}
              />
              <StatRow
                label="Total Secured"
                value={stats.reduce((sum, s) => sum + s.secured, 0)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
