'use client'

import { useMemo } from 'react'
import { MapPinIcon } from 'lucide-react'
import type { MapBid } from './MapPageClient'

interface JobListPanelProps {
  bids: MapBid[]
  selectedBidId: string | null
  hoveredBidId: string | null
  onBidHover: (id: string | null) => void
  onBidClick: (id: string) => void
}

function formatCurrency(value: number | null): string {
  if (value == null) return 'TBD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function JobListPanel({
  bids,
  selectedBidId,
  hoveredBidId,
  onBidHover,
  onBidClick,
}: JobListPanelProps) {
  const sorted = useMemo(
    () =>
      [...bids].sort(
        (a, b) => new Date(b.bid_due_date).getTime() - new Date(a.bid_due_date).getTime()
      ),
    [bids]
  )

  return (
    <div
      style={{
        height: 'calc(100dvh - 120px)',
        borderRadius: 12,
        border: '0.5px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          Awarded / Verbal Jobs
        </span>
        <span
          style={{
            marginLeft: '8px',
            fontSize: '0.75rem',
            color: 'var(--text3)',
            background: 'var(--surface2)',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {bids.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
        }}
      >
        {sorted.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text3)',
            }}
          >
            No awarded or verbal jobs with coordinates.
          </div>
        ) : (
          sorted.map((bid) => {
            const isSelected = bid.id === selectedBidId
            const isHovered = bid.id === hoveredBidId

            return (
              <div
                key={bid.id}
                onMouseEnter={() => onBidHover(bid.id)}
                onMouseLeave={() => onBidHover(null)}
                onClick={() => onBidClick(bid.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: isSelected
                    ? 'var(--blue-2)'
                    : isHovered
                      ? 'var(--surface2)'
                      : 'transparent',
                  border: isSelected
                    ? '1px solid var(--blue-6)'
                    : '1px solid transparent',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                {/* Project name */}
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bid.project_name}
                </div>

                {/* Branch + Status */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: 'var(--text2)',
                      background: 'var(--surface2)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {bid.branch}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: bid.status === 'Awarded' ? '#16a34a' : '#d97706',
                      background: bid.status === 'Awarded' ? '#dcfce7' : '#fef3c7',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {bid.status}
                  </span>
                </div>

                {/* Location + Value */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.6875rem',
                      color: 'var(--text3)',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <MapPinIcon style={{ width: 10, height: 10, flexShrink: 0 }} />
                    {bid.project_location || '—'}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text)',
                      fontFamily: '"IBM Plex Mono", monospace',
                      flexShrink: 0,
                    }}
                  >
                    {formatCurrency(bid.total_price)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
