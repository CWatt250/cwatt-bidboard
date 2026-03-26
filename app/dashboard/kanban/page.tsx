'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { useBids, type Bid, type BidStatus } from '@/hooks/useBids'
import { createClient } from '@/lib/supabase/client'

const STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent']

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
    { Unassigned: [], Bidding: [], 'In Progress': [], Sent: [] }
  )

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kanban Board</h1>
        <NewBidDialog />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Loading bids…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error loading bids: {error}
        </div>
      )}

      {!loading && !error && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
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
  )
}
