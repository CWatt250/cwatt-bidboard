'use client'

import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'

const BRANCH_ORDER: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

interface EstimatorStat {
  userId: string
  name: string
  total: number
  awarded: number
  verbal: number
  bidIds: string[]
}

interface ScorestripBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

function buildEstimatorStats(bids: ScorestripBid[]): EstimatorStat[] {
  const map = new Map<string, EstimatorStat>()

  for (const bid of bids) {
    const uid = bid.estimator_id ?? 'unassigned'
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        name: bid.estimator_name ?? 'Unassigned',
        total: 0,
        awarded: 0,
        verbal: 0,
        bidIds: [],
      })
    }
    const stat = map.get(uid)!
    stat.total++
    if (bid.status === 'Awarded') stat.awarded++
    if (bid.status === 'Verbal') stat.verbal++
    stat.bidIds.push(bid.id)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export function EstimatorScorestrip({
  bids,
  onEstimatorClick,
}: {
  bids: ScorestripBid[]
  onEstimatorClick: (bidId: string) => void
}) {
  const stats = buildEstimatorStats(bids)
  if (stats.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '4px 0 8px',
      }}
    >
      {stats.map((s) => (
        <button
          key={s.userId}
          type="button"
          onClick={() => {
            if (s.bidIds.length > 0) onEstimatorClick(s.bidIds[0])
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '10px 14px',
            cursor: 'pointer',
            minWidth: 200,
            flexShrink: 0,
            transition: 'border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.8125rem' }}>
              {s.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
              {s.name}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text3)' }}>
                {s.total} total
              </span>
              {s.awarded > 0 && (
                <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600 }}>
                  {s.awarded} awarded
                </span>
              )}
              {s.verbal > 0 && (
                <span style={{ fontSize: '0.6875rem', color: '#3b82f6', fontWeight: 600 }}>
                  {s.verbal} verbal
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export { BRANCH_ORDER }
