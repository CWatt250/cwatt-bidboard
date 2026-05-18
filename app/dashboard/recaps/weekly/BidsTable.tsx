'use client'

import { format } from 'date-fns'
import { STATUS_BADGE_CLASSES, BRANCH_BADGE_CLASSES } from '@/config/colors'
import { getBidClientName } from '@/lib/supabase/types'
import type { Bid } from '@/lib/supabase/types'
import { estimatorScopedPrice } from '@/lib/recap-aggregations'

interface BidsTableProps {
  title: string
  subtitle: string
  bids: Bid[]
  emptyMessage?: string
  /** When set, the Bid Price column shows only this estimator's scoped value. */
  estimatorId?: string | null
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function BidsTable({
  title,
  subtitle,
  bids,
  emptyMessage = 'No bids in this range.',
  estimatorId = null,
}: BidsTableProps) {
  const sorted = [...bids].sort((a, b) => {
    const av = a.bid_due_date ?? ''
    const bv = b.bid_due_date ?? ''
    if (av < bv) return -1
    if (av > bv) return 1
    return 0
  })

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: '-0.2px',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text3)',
            marginTop: 2,
          }}
        >
          {subtitle}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text3)',
          }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface2)' }}>
                {['Due', 'Branch', 'Status', 'Project', 'Client(s)', 'Location', 'Bid Price'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 14px',
                      textAlign: h === 'Bid Price' ? 'right' : 'left',
                      fontSize: '10px',
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
              {sorted.map((bid) => {
                const clientNames = (bid.clients ?? [])
                  .map(getBidClientName)
                  .filter(Boolean)
                const clientDisplay =
                  clientNames.length === 0
                    ? '—'
                    : clientNames.length === 1
                      ? clientNames[0]
                      : `${clientNames[0]} +${clientNames.length - 1}`
                const due = bid.bid_due_date ? new Date(bid.bid_due_date + 'T00:00:00') : null
                const price = estimatorScopedPrice(bid, estimatorId)
                return (
                  <tr
                    key={bid.id}
                    onClick={() =>
                      window.open(`/dashboard/bids/${bid.id}`, '_blank', 'noopener,noreferrer')
                    }
                    style={{
                      borderBottom: '0.5px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 14px',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}
                    >
                      {due ? format(due, 'EEE, MMM d') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className={`inline-flex items-center px-1.5 py-0 rounded text-xs border ${BRANCH_BADGE_CLASSES[bid.branch] ?? ''}`}
                        style={{ fontSize: '10px' }}
                      >
                        {bid.branch}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border ${STATUS_BADGE_CLASSES[bid.status]}`}
                        style={{ fontSize: '10px' }}
                      >
                        {bid.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        fontWeight: 500,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={bid.project_name}
                    >
                      {bid.project_name}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        color: 'var(--text3)',
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
                        padding: '10px 14px',
                        color: 'var(--text3)',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={bid.project_location ?? undefined}
                    >
                      {bid.project_location || '—'}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontFamily: '"IBM Plex Mono", monospace',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {price ? formatCurrency(price) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
