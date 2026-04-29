'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { TodoList } from '@/components/workspace/TodoList'
import { RecentActivity } from '@/components/workspace/RecentActivity'
import { KpiRow } from '@/components/workspace/KpiRow'
import { useBids, type Bid, type BidStatus } from '@/hooks/useBids'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { logActivity } from '@/lib/activity'

const STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent']

export default function KanbanPage() {
  const { bids, loading, error } = useBids()
  const { openBid } = useBidDetail()
  const { profile } = useUserRole()
  const [localBids, setLocalBids] = useState<Bid[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const myBids = profile
      ? bids.filter((b) => b.estimator_id === profile.id || b.estimator_id === null)
      : []
    setLocalBids(myBids)
  }, [bids, profile])

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
    const draggedBid = prevBids.find((b) => b.id === draggableId)
    const prevStatus = draggedBid?.status

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
      return
    }

    if (profile && prevStatus && prevStatus !== newStatus) {
      await logActivity(
        draggableId,
        profile.id,
        `Status changed from ${prevStatus} to ${newStatus}`
      )
    }

    if (newStatus === 'Sent' && draggedBid) {
      openBid({ ...draggedBid, status: 'Sent' })
    }
  }

  // Current calendar week (Sunday → Saturday), recomputed on each render so
  // it auto-rolls forward at midnight without a refresh.
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const startStr = toDateStr(startOfWeek)
  const endStr = toDateStr(endOfWeek)

  function inCurrentWeek(bid: Bid): boolean {
    if (!bid.bid_due_date) return false
    return bid.bid_due_date >= startStr && bid.bid_due_date <= endStr
  }
  function currentWeekOrFuture(bid: Bid): boolean {
    if (!bid.bid_due_date) return true
    return bid.bid_due_date >= startStr
  }

  const bidsByStatus = STATUSES.reduce<Record<BidStatus, Bid[]>>(
    (acc, status) => {
      const ofStatus = localBids.filter((b) => b.status === status)
      acc[status] =
        status === 'Unassigned'
          ? ofStatus.filter(currentWeekOrFuture)
          : ofStatus.filter(inCurrentWeek)
      return acc
    },
    { Unassigned: [], Bidding: [], 'In Progress': [], Sent: [] } as unknown as Record<BidStatus, Bid[]>
  )

  return (
    <div className="flex flex-col h-full gap-4 min-h-0" style={{ background: 'var(--bg)' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text3)', flexShrink: 0 }}>
        <Link
          href="/dashboard"
          style={{ color: 'var(--text3)', textDecoration: 'none', transition: 'color 150ms' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}
        >
          Dashboard
        </Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)' }}>My Workspace</span>
      </div>

      {/* Page title row */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2, marginBottom: 4 }}>
            My Workspace
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text3)', margin: 0 }}>
            Drag and drop bids to move them through your process
          </p>
        </div>
        <NewBidDialog />
      </div>

      {/* KPI Row */}
      <KpiRow bids={localBids} />

      {/* Main content: kanban + right panel */}
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
                    background: 'var(--surface)',
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

        {/* Right: sidebar — fixed width, does not scroll with board */}
        <div className="w-[280px] shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <div className="shrink-0">
            <TodoList />
          </div>
          <div className="shrink-0">
            <RecentActivity />
          </div>
        </div>
      </div>
    </div>
  )
}
