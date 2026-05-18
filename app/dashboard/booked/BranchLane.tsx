'use client'

import { ChevronRight } from 'lucide-react'
import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import { JobCard } from './JobCard'

const BRANCH_COLORS: Record<Branch, string> = {
  PSC: '#3b82f6',
  SEA: '#10b981',
  POR: '#f59e0b',
  PHX: '#ef4444',
  SLC: '#8b5cf6',
}

interface BranchLaneBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

/**
 * One branch swim lane. Always renders its header — when `bids` is empty
 * (e.g. a search filtered every card out) the card strip shows an empty
 * state rather than the lane disappearing.
 */
export function BranchLane({ branch, bids }: { branch: Branch; bids: BranchLaneBid[] }) {
  const totalValue = bids.reduce((sum, b) => {
    const v = b.total_price ?? b.line_items?.reduce((s, li) => s + (li.price ?? 0), 0) ?? 0
    return sum + v
  }, 0)

  // Only show a dollar figure when prices are actually entered.
  const totalLabel =
    totalValue > 0
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalValue)
      : '—'

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Lane header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: BRANCH_COLORS[branch],
            letterSpacing: '0.02em',
          }}
        >
          {branch}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text3)' }}>
          {BRANCH_LABELS[branch]}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text3)' }}>
          {bids.length} job{bids.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text2)', fontWeight: 500 }}>
          {totalLabel}
        </span>
        {bids.length > 3 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              marginLeft: 'auto',
              fontSize: '0.625rem',
              color: 'var(--text3)',
            }}
          >
            scroll
            <ChevronRight size={11} />
          </span>
        )}
      </div>

      {/* Scrollable card row */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          padding: '4px 4px 8px',
          scrollBehavior: 'smooth',
        }}
      >
        {bids.length > 0 ? (
          bids.map((bid) => <JobCard key={bid.id} bid={bid} />)
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', padding: '16px 4px' }}>
            No matching projects
          </div>
        )}
      </div>
    </div>
  )
}
