'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { TodoList } from '@/components/workspace/TodoList'
import { useBids, type Bid, type BidStatus } from '@/hooks/useBids'
import { createClient } from '@/lib/supabase/client'

const STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']

export default function KanbanPage() {
  const { bids, loading, error } = useBids()
  const [localBids, setLocalBids] = useState<Bid[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    setLocalBids(bids)
  }, [bids])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return

    const newStatus = destination.droppableId as BidStatus
    const prevBids = localBids

    setLocalBids((prev) =>
      prev.map((b) => (b.id === draggableId ? { ...b, status: newStatus } : b))
    )

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('bids')
      .update({ status: newStatus })
      .eq('id', draggableId)

    if (updateError) {
      setLocalBids(prevBids)
      toast.error('Failed to update bid status. Please try again.')
    }
  }

  const bidsByStatus = STATUSES.reduce<Record<BidStatus, Bid[]>>(
    (acc, status) => {
      acc[status] = localBids.filter((b) => b.status === status)
      return acc
    },
    { Unassigned: [], Bidding: [], 'In Progress': [], Sent: [], Awarded: [], Lost: [] }
  )

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>My Workspace</h1>
        <NewBidDialog />
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Kanban board — horizontally scrollable */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {loading && (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    width: 288,
                    flexShrink: 0,
                    height: 280,
                    borderRadius: 'var(--radius)',
                  }}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="error-card">
              Error loading bids: {error}
            </div>
          )}

          {!loading && !error && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                {STATUSES.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    bids={bidsByStatus[status]}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </DragDropContext>
          )}
        </div>

        {/* Right: To-Do sidebar — fixed width, does not scroll with board */}
        <div className="w-[280px] shrink-0 flex flex-col min-h-0">
          <TodoList />
        </div>
      </div>
    </div>
  )
}
