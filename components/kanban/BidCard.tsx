'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Bid } from '@/hooks/useBids'
import { SCOPE_BADGE_CLASSES, DUE_DATE_URGENT_CLASS, DUE_DATE_WARNING_CLASS } from '@/config/colors'

function dueDateClass(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return DUE_DATE_URGENT_CLASS
  if (diffDays <= 7) return DUE_DATE_WARNING_CLASS
  return 'text-muted-foreground'
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'TBD'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

interface BidCardProps {
  bid: Bid
  index: number
  currentUserId: string | null
}

export function BidCard({ bid, index, currentUserId }: BidCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    setClaiming(true)
    const supabase = createClient()
    await supabase
      .from('bids')
      .update({ estimator_id: currentUserId, status: 'Bidding' })
      .eq('id', bid.id)
    setClaiming(false)
  }

  return (
    <>
      <Draggable draggableId={bid.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={snapshot.isDragging ? 'opacity-80 rotate-1' : ''}
            onClick={() => setDrawerOpen(true)}
          >
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all select-none">
              <CardContent className="space-y-2 pt-0">
                <div className="font-semibold text-sm leading-tight">{bid.project_name}</div>
                <div className="text-xs text-muted-foreground">{bid.client}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    className={SCOPE_BADGE_CLASSES[bid.scope]}
                    variant="outline"
                  >
                    {bid.scope}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{bid.branch}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {bid.estimator_name ?? <span className="italic">Unassigned</span>}
                </div>
                <div className={`text-xs ${dueDateClass(bid.bid_due_date)}`}>
                  Due: {new Date(bid.bid_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-xs font-medium">{formatCurrency(bid.bid_price)}</div>
              </CardContent>
              {bid.status === 'Unassigned' && (
                <CardFooter onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={claiming || !currentUserId}
                    onClick={handleClaim}
                  >
                    {claiming ? 'Claiming…' : 'Claim'}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}
      </Draggable>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{bid.project_name}</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Bid Detail Coming Soon
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
