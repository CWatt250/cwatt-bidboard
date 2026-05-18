'use client'

import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { STATUS_BADGE_CLASSES, BRANCH_BADGE_CLASSES } from '@/config/colors'
import { getBidClientName } from '@/lib/supabase/types'
import type { Bid } from '@/lib/supabase/types'

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

/** A bid's value — prefers the precomputed total, falls back to line items. */
function bidValue(b: Bid): number {
  if (typeof b.total_price === 'number') return b.total_price
  return (b.line_items ?? []).reduce((sum, li) => sum + (li.price ?? 0), 0)
}

interface WeeklyBidsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Secured Last Week" or "Verbals Last Week". */
  title: string
  /** e.g. "May 11 – May 17 · $105.7K · 1 bid". */
  subtitle: string
  /** The specific bids to list. */
  bids: Bid[]
}

/**
 * Right-side drawer listing the bids behind a Quick Totals stat — reused for
 * both "Secured Last Week" and "Verbals Last Week".
 */
export function WeeklyBidsDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  bids,
}: WeeklyBidsDrawerProps) {
  const sorted = [...bids].sort((a, b) => bidValue(b) - bidValue(a))
  const total = sorted.reduce((sum, b) => sum + bidValue(b), 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[540px]">
        <div className="flex flex-col h-full">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
              <SheetClose className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X size={16} />
              </SheetClose>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </SheetHeader>

          {/* Scrollable bid list */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No bids found for this period
              </p>
            ) : (
              sorted.map((bid) => {
                const clientNames = (bid.clients ?? []).map(getBidClientName).filter(Boolean)
                const clientDisplay =
                  clientNames.length === 0
                    ? '—'
                    : clientNames.length === 1
                      ? clientNames[0]
                      : `${clientNames[0]} +${clientNames.length - 1}`
                return (
                  <div
                    key={bid.id}
                    className="flex flex-col gap-2 p-3 rounded-lg border bg-card"
                  >
                    {/* Branch badge + clickable project name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0 rounded border shrink-0 ${BRANCH_BADGE_CLASSES[bid.branch] ?? ''}`}
                        style={{ fontSize: '10px' }}
                      >
                        {bid.branch}
                      </span>
                      <a
                        href={`/dashboard/bids/${bid.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold truncate hover:underline"
                        style={{ color: 'var(--text)' }}
                        title={bid.project_name}
                      >
                        {bid.project_name}
                      </a>
                    </div>

                    {/* Status pill + client + value */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border shrink-0 ${STATUS_BADGE_CLASSES[bid.status]}`}
                          style={{ fontSize: '10px' }}
                        >
                          {bid.status}
                        </span>
                        <span
                          className="text-xs text-muted-foreground truncate"
                          title={clientNames.join(', ') || undefined}
                        >
                          {clientDisplay}
                        </span>
                      </div>
                      <span
                        className="text-xs shrink-0"
                        style={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontWeight: 600,
                          color: '#10b981',
                        }}
                      >
                        {formatCurrency(bidValue(bid))}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pinned total footer */}
          <div className="shrink-0 mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span
              className="text-sm"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
