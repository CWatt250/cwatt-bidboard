'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import { EstimatorScorestrip, BRANCH_ORDER } from './EstimatorScorestrip'
import { BranchLane } from './BranchLane'
import type { BranchLaneHandle } from './BranchLane'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { JobCard } from './JobCard'

const BID_QUERY = `
  id,
  project_name,
  branch,
  estimator_id,
  status,
  bid_due_date,
  project_start_date,
  notes,
  created_at,
  updated_at,
  profiles!bids_estimator_id_fkey(name),
  bid_line_items(*),
  bid_clients(*, clients(name))
`

interface BookedBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

type Status = 'loading' | 'error' | 'success'

export function BookedWorkClient() {
  const [bids, setBids] = useState<BookedBid[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('branch')

  // Refs to each BranchLane for scroll-to-estimator
  const laneRefs = useRef<Map<Branch, BranchLaneHandle>>(new Map())

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('bids')
      .select(BID_QUERY)
      .in('status', ['Awarded', 'Verbal'])
      .order('bid_due_date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setStatus('error')
        } else {
          // Map estimator_name from joined profiles
          const mapped = (data as any[]).map((b: any) => ({
            ...b,
            estimator_name: b.profiles?.name ?? null,
          })) as BookedBid[]
          setBids(mapped)
          setStatus('success')
        }
      })
  }, [])

  const handleEstimatorClick = useCallback(
    (bidId: string) => {
      // Find the bid to know its branch and estimator
      const bid = bids.find((b) => b.id === bidId)
      if (!bid) return

      // Scroll to the branch lane containing this bid, then find the card
      if (viewMode === 'branch' || viewMode === 'value') {
        const laneHandle = laneRefs.current.get(bid.branch)
        laneHandle?.scrollToBid(bidId)
      } else {
        // By-estimator view: scroll to the estimator section
        const el = document.getElementById(`estimator-section-${bid.estimator_id ?? 'unassigned'}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Brief highlight
        const card = document.getElementById(`bid-card-${bidId}`)
        if (card) {
          card.style.boxShadow = '0 0 0 2px var(--ring)'
          setTimeout(() => { card.style.boxShadow = '' }, 2000)
        }
      }
    },
    [bids, viewMode],
  )

  // ---- Loading ----
  if (status === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          color: 'var(--text3)',
          fontSize: '0.875rem',
        }}
      >
        Loading booked work...
      </div>
    )
  }

  // ---- Error ----
  if (status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          gap: 8,
        }}
      >
        <p style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 500 }}>
          Failed to load booked work
        </p>
        <p style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{error}</p>
      </div>
    )
  }

  // ---- Empty ----
  if (bids.length === 0) {
    return (
      <div className="space-y-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.3px',
            }}
          >
            Booked Work
          </h1>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            color: 'var(--text3)',
            fontSize: '0.875rem',
          }}
        >
          No awarded or verbal bids yet.
        </div>
      </div>
    )
  }

  // ---- Branch-lanes view ----
  function renderBranchLanes() {
    return BRANCH_ORDER.map((branch) => {
      const branchBids = bids.filter((b) => b.branch === branch)
      return (
        <BranchLane
          key={branch}
          branch={branch}
          bids={branchBids}
          ref={(handle) => {
            if (handle) laneRefs.current.set(branch, handle)
            else laneRefs.current.delete(branch)
          }}
        />
      )
    })
  }

  // ---- By-estimator view ----
  function renderByEstimator() {
    const grouped = new Map<string, BookedBid[]>()
    for (const b of bids) {
      const key = b.estimator_id ?? 'unassigned'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(b)
    }
    const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {entries.map(([key, estimatorBids]) => {
          const name = estimatorBids[0]?.estimator_name ?? 'Unassigned'
          return (
            <div key={key} id={`estimator-section-${key}`}>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: 10,
                  paddingLeft: 4,
                }}
              >
                {name}
                <span style={{ fontSize: '0.6875rem', color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>
                  {estimatorBids.length} job{estimatorBids.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 4px 8px' }}>
                {estimatorBids.map((bid) => (
                  <div key={bid.id} id={`bid-card-${bid.id}`}>
                    <JobCard bid={bid} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ---- Sort-by-value view ----
  function renderByValue() {
    const sorted = [...bids].sort((a, b) => {
      const aVal = a.line_items?.reduce((s, li) => s + (li.price ?? 0), 0) ?? 0
      const bVal = b.line_items?.reduce((s, li) => s + (li.price ?? 0), 0) ?? 0
      return bVal - aVal
    })

    return (
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 4px 8px', flexWrap: 'wrap' }}>
        {sorted.map((bid) => (
          <div key={bid.id} id={`bid-card-${bid.id}`}>
            <JobCard bid={bid} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}
        >
          Booked Work
        </h1>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      <EstimatorScorestrip bids={bids} onEstimatorClick={handleEstimatorClick} />

      <div>
        {viewMode === 'branch' && renderBranchLanes()}
        {viewMode === 'estimator' && renderByEstimator()}
        {viewMode === 'value' && renderByValue()}
      </div>
    </div>
  )
}
