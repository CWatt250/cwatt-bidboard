'use client'

import { useCallback, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { InlineStatusCell } from '@/components/bids/InlineStatusCell'
import type { Bid, Branch } from '@/lib/supabase/types'

const BRANCH_COLORS: Record<Branch, string> = {
  PSC: '#2563eb',
  SEA: '#16a34a',
  POR: '#dc2626',
  PHX: '#d97706',
  SLC: '#8b5cf6',
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

interface AtRiskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bids: Bid[]
  userId: string | null
}

export function AtRiskDrawer({ open, onOpenChange, bids, userId }: AtRiskDrawerProps) {
  // Keep local copy so we can optimistically remove bids that are no longer at-risk
  const [localBids, setLocalBids] = useState<Bid[]>(bids)

  // Sync when props change and drawer opens
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setLocalBids(bids)
      onOpenChange(next)
    },
    [bids, onOpenChange],
  )

  const total = localBids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)

  const handleStatusChange = useCallback(
    async (bidId: string, newStatus: string) => {
      // If the new status is a "sent" status (not pre-sent), remove from at-risk list
      const preSentStatuses = new Set(['Unassigned', 'Bidding', 'In Progress'])
      if (!preSentStatuses.has(newStatus)) {
        setLocalBids((prev) => prev.filter((b) => b.id !== bidId))
      }
    },
    [],
  )

  // Sort by bid_due_date ASC (most overdue first)
  const sorted = [...localBids].sort(
    (a, b) => new Date(a.bid_due_date!).getTime() - new Date(b.bid_due_date!).getTime(),
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[540px]">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} color="#d97706" />
              <SheetTitle className="text-base font-semibold">
                Past due — pre-Sent status
              </SheetTitle>
            </div>
            <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X size={16} />
            </SheetClose>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length} bid{sorted.length === 1 ? '' : 's'} · worth {formatCurrency(total)}
          </p>
        </SheetHeader>

        <div className="overflow-y-auto pr-2 space-y-3">
          {sorted.map((bid) => (
            <div
              key={bid.id}
              className="flex flex-col gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{bid.project_name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {bid.project_location}
                  </p>
                </div>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: BRANCH_COLORS[bid.branch] }}
                >
                  {bid.branch}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {bid.bid_due_date && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {daysOverdue(bid.bid_due_date)} day{daysOverdue(bid.bid_due_date) === 1 ? '' : 's'} overdue
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(bid.total_price ?? 0)}
                  </span>
                </div>
                <InlineStatusCell
                  bidId={bid.id}
                  userId={userId}
                  projectName={bid.project_name}
                  initialStatus={bid.status}
                />
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No at-risk bids remaining.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
