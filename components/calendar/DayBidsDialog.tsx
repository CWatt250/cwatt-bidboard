'use client'

import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBidDetail } from '@/contexts/bidDetail'
import type { Bid, BidStatus } from '@/hooks/useBids'

const STATUS_COLORS: Record<BidStatus, { bg: string; text: string; border: string }> = {
  Unassigned:    { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  Bidding:       { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
  'In Progress': { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  Sent:          { bg: '#D1FAE5', text: '#047857', border: '#6EE7B7' },
  Awarded:       { bg: '#D1FAE5', text: '#065F46', border: '#34D399' },
  Lost:          { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'TBD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

interface DayBidsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | null
  bids: Bid[]
}

export default function DayBidsDialog({ open, onOpenChange, date, bids }: DayBidsDialogProps) {
  const { openBid } = useBidDetail()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {date ? `Bids due ${format(date, 'EEEE, MMM d, yyyy')}` : 'Bids'}
          </DialogTitle>
        </DialogHeader>

        {bids.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>
            No bids due on this day.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
            {bids.map((bid) => {
              const status = STATUS_COLORS[bid.status] ?? STATUS_COLORS.Unassigned
              return (
                <button
                  key={bid.id}
                  onClick={() => {
                    onOpenChange(false)
                    openBid(bid)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                  className="hover:bg-[var(--surface2)]"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bid.project_name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                      {bid.estimator_name ?? 'Unassigned'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: status.bg,
                        color: status.text,
                        border: `1px solid ${status.border}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {bid.status}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                      {formatCurrency(bid.total_price ?? null)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
