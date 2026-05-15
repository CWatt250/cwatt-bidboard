'use client'

import { useRef, forwardRef, useImperativeHandle } from 'react'
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

export interface BranchLaneHandle {
  scrollToBid: (bidId: string) => void
}

export const BranchLane = forwardRef<BranchLaneHandle, { branch: Branch; bids: BranchLaneBid[] }>(
  function BranchLane({ branch, bids }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    useImperativeHandle(ref, () => ({
      scrollToBid(bidId: string) {
        const card = cardRefs.current.get(bidId)
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
          card.style.boxShadow = '0 0 0 2px var(--ring)'
          setTimeout(() => {
            card.style.boxShadow = ''
          }, 2000)
        }
      },
    }))

    if (bids.length === 0) return null

    const totalValue = bids.reduce((sum, b) => {
      const v = b.line_items?.reduce((s, li) => s + (li.price ?? 0), 0) ?? 0
      return sum + v
    }, 0)

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
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(totalValue)}
          </span>
        </div>

        {/* Scrollable card row */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            padding: '4px 4px 8px',
            scrollBehavior: 'smooth',
          }}
        >
          {bids.map((bid) => (
            <div
              key={bid.id}
              ref={(el) => {
                if (el) cardRefs.current.set(bid.id, el)
                else cardRefs.current.delete(bid.id)
              }}
            >
              <JobCard bid={bid} />
            </div>
          ))}
        </div>
      </div>
    )
  },
)
