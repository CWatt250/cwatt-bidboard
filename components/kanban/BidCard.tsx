'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

interface BidCardProps {
  bid: Bid
  index: number
  currentUserId: string | null
}

export function BidCard({ bid, index, currentUserId }: BidCardProps) {
  const { openBid } = useBidDetail()
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

  const lineItems = bid.line_items ?? []

  // Unique clients — max 2 shown
  const uniqueClients = [...new Set(lineItems.map((li) => li.client))]
  const clientsDisplay =
    uniqueClients.length === 0
      ? null
      : uniqueClients.slice(0, 2).join(', ') +
        (uniqueClients.length > 2 ? ` +${uniqueClients.length - 2} more` : '')

  // Unique scopes — max 2 badges
  const uniqueScopes = [...new Set(lineItems.map((li) => li.scope))]
  const extraScopes = uniqueScopes.length > 2 ? uniqueScopes.length - 2 : 0

  // Total price
  const hasPrice = lineItems.some((li) => li.price !== null)
  const totalPriceDisplay = hasPrice ? formatCurrency(bid.total_price ?? 0) : 'TBD'

  return (
    <>
      <Draggable draggableId={bid.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={snapshot.isDragging ? 'opacity-80 rotate-1' : ''}
            onClick={() => openBid(bid)}
          >
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all select-none">
              <CardContent className="space-y-2 pt-0">
                <div className="font-semibold text-sm leading-tight">{bid.project_name}</div>
                {clientsDisplay && (
                  <div className="text-xs text-muted-foreground">{clientsDisplay}</div>
                )}
                <div className="flex flex-wrap gap-1">
                  {uniqueScopes.slice(0, 2).map((scope) => (
                    <Badge
                      key={scope}
                      className={SCOPE_BADGE_CLASSES[scope]}
                      variant="outline"
                    >
                      {scope}
                    </Badge>
                  ))}
                  {extraScopes > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{extraScopes} more
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">{bid.branch}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {bid.estimator_name ?? <span className="italic">Unassigned</span>}
                </div>
                <div className={`text-xs ${dueDateClass(bid.bid_due_date)}`}>
                  Due: {new Date(bid.bid_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-xs font-medium">{totalPriceDisplay}</div>
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

    </>
  )
}
