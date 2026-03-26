'use client'

import { Droppable } from '@hello-pangea/dnd'
import { BidCard } from '@/components/kanban/BidCard'
import type { Bid, BidStatus } from '@/hooks/useBids'

const STATUS_LEFT_BORDER: Record<BidStatus, string> = {
  Unassigned:    '#8892b0',
  Bidding:       '#38bdf8',
  'In Progress': '#f59e0b',
  Sent:          '#10b981',
  Awarded:       '#10b981',
  Lost:          '#ef4444',
}

interface KanbanColumnProps {
  status: BidStatus
  bids: Bid[]
  currentUserId: string | null
}

export function KanbanColumn({ status, bids, currentUserId }: KanbanColumnProps) {
  const accentColor = STATUS_LEFT_BORDER[status]

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
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '100px',
            background: 'var(--surface2)',
            color: 'var(--text2)',
            fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
          }}
        >
          {bids.length}
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
          </div>
        )}
      </Droppable>
    </div>
  )
}
