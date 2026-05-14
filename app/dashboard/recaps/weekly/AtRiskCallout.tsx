'use client'

import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import type { AtRiskSummary } from '@/lib/recap-aggregations'

interface AtRiskCalloutProps {
  summary: AtRiskSummary
  scale?: number
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function AtRiskCallout({ summary, scale = 1 }: AtRiskCalloutProps) {
  if (summary.count <= 0) return null

  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(239, 68, 68, 0.06) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        padding: `${14 * scale}px ${18 * scale}px`,
        display: 'flex',
        alignItems: 'center',
        gap: `${14 * scale}px`,
      }}
    >
      <AlertTriangle
        size={24 * scale}
        color="#d97706"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: `${14 * scale}px`,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {summary.count} bid{summary.count === 1 ? '' : 's'} past due — still in pre-Sent status
        </p>
        <p
          style={{
            fontSize: `${12 * scale}px`,
            color: 'var(--text3)',
            marginTop: 2,
          }}
        >
          Worth {formatCurrency(summary.total)}
          {summary.earliestDue && (
            <> · earliest {format(summary.earliestDue, 'MMM d, yyyy')}</>
          )}
        </p>
      </div>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        style={{
          fontSize: `${12 * scale}px`,
          fontWeight: 600,
          color: '#d97706',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Review →
      </a>
    </div>
  )
}
