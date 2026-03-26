'use client'

import { Droppable } from '@hello-pangea/dnd'
import { BidCard } from '@/components/kanban/BidCard'
import type { Bid, BidStatus } from '@/hooks/useBids'
import { STATUS_COLUMN_STYLES } from '@/config/colors'

interface KanbanColumnProps {
  status: BidStatus
  bids: Bid[]
  currentUserId: string | null
}

export function KanbanColumn({ status, bids, currentUserId }: KanbanColumnProps) {
  const styles = STATUS_COLUMN_STYLES[status]

  return (
    <div className="flex flex-col w-72 shrink-0 rounded-xl overflow-hidden border border-border">
      <div className={`flex items-center justify-between px-3 py-2 ${styles.header}`}>
        <span className="font-semibold text-sm">{status}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/40 dark:bg-black/20">
          {bids.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[200px] p-2 space-y-2 transition-colors ${styles.bg} ${
              snapshot.isDraggingOver ? 'ring-2 ring-inset ring-primary/30' : ''
            }`}
          >
            {bids.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
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
