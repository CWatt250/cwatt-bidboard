'use client'

import { Droppable } from '@hello-pangea/dnd'
import { BidCard } from '@/components/kanban/BidCard'
import type { Bid, BidStatus } from '@/hooks/useBids'

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `$${Math.round(val / 1_000)}K`
  return `$${Math.round(val)}`
}

const STATUS_LEFT_BORDER: Record<BidStatus, string> = {
  Unassigned:    '#8892b0',
  Bidding:       '#38bdf8',
  'In Progress': '#f59e0b',
  Sent:          '#10b981',
  Awarded:       '#059669',
  Lost:          '#ef4444',
}

interface KanbanColumnProps {
  status: BidStatus
  bids: Bid[]
  currentUserId: string | null
}

export function KanbanColumn({ status, bids, currentUserId }: KanbanColumnProps) {
  const accentColor = STATUS_LEFT_BORDER[status]
  const totalValue = bids.reduce((s, b) => s + (b.total_price ?? 0), 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '288px',
        flexShrink: 0,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Column Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          borderLeft: `3px solid ${accentColor}`,
          background: 'var(--surface)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)', letterSpacing: '-0.2px' }}>
          {status}
          <span style={{ fontWeight: 500, color: 'var(--text3)', marginLeft: 6 }}>
            {bids.length}
            {totalValue > 0 && (
              <> · <span style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}>{formatCompact(totalValue)}</span></>
            )}
          </span>
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              minHeight: 200,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: snapshot.isDraggingOver ? 'var(--accent-light)' : 'var(--surface2)',
              transition: 'background 200ms ease',
              outline: snapshot.isDraggingOver ? `2px solid var(--accent-border)` : 'none',
              outlineOffset: '-2px',
            }}
          >
            {bids.length === 0 && !snapshot.isDraggingOver && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 80,
                color: 'var(--text3)',
                fontSize: '0.75rem',
                fontStyle: 'italic',
              }}>
                No bids
              </div>
            )}
            {bids.map((bid, index) => (
              <BidCard key={bid.id} bid={bid} index={index} currentUserId={currentUserId} />
            ))}
            {provided.placeholder}
            {/* Add Bid button */}
            <button
              style={{
                width: '100%',
                padding: '6px 0',
                borderRadius: 6,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text3)',
                background: 'transparent',
                border: '1px dashed var(--border)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                marginTop: 2,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.color = 'var(--accent)'
                el.style.borderColor = 'var(--accent)'
                el.style.background = 'var(--accent-light)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.color = 'var(--text3)'
                el.style.borderColor = 'var(--border)'
                el.style.background = 'transparent'
              }}
            >
              + Add Bid
            </button>
          </div>
        )}
      </Droppable>
    </div>
  )
}
