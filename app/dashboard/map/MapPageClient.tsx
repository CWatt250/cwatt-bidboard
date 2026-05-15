'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { useBidDetail } from '@/contexts/bidDetail'
import { IREX_BRANCHES } from '@/config/irex-branches'

const LocalsMap = dynamic(() => import('./LocalsMap'), { ssr: false })
const JobListPanel = dynamic(() => import('./JobListPanel'), { ssr: false })

export interface MapBid {
  id: string
  project_name: string
  branch: string
  status: string
  total_price: number | null
  latitude: number
  longitude: number
  bid_due_date: string
  project_location: string | null
}

export function MapPageClient() {
  const [bids, setBids] = useState<MapBid[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)
  const [hoveredBidId, setHoveredBidId] = useState<string | null>(null)

  const { openBid, selectedBid } = useBidDetail()

  // Sync local selectedBidId when drawer closes
  useEffect(() => {
    if (!selectedBid) setSelectedBidId(null)
  }, [selectedBid])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('bids')
      .select('id, project_name, branch, status, latitude, longitude, bid_due_date, project_location, bid_line_items(price)')
      .in('status', ['Awarded', 'Verbal'])
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data }) => {
        const rows: MapBid[] = ((data ?? []) as {
          id: string
          project_name: string
          branch: string
          status: string
          latitude: number
          longitude: number
          bid_due_date: string
          project_location: string | null
          bid_line_items: { price: number | null }[]
        }[]).map((b) => ({
          id: b.id,
          project_name: b.project_name,
          branch: b.branch,
          status: b.status,
          latitude: b.latitude,
          longitude: b.longitude,
          bid_due_date: b.bid_due_date,
          project_location: b.project_location,
          total_price: b.bid_line_items.reduce<number | null>((sum, li) => {
            if (li.price == null) return sum
            return (sum ?? 0) + li.price
          }, null),
        }))
        setBids(rows)
        setLoading(false)
      })
  }, [])

  const handleBidHover = useCallback((id: string | null) => {
    setHoveredBidId(id)
  }, [])

  const handleBidClick = useCallback(async (id: string) => {
    setSelectedBidId(id)

    const supabase = createClient()
    const { data } = await supabase
      .from('bids')
      .select(`
        id,
        project_name,
        project_location,
        mike_estimate_number,
        branch,
        estimator_id,
        status,
        bid_due_date,
        project_start_date,
        notes,
        created_at,
        updated_at,
        profiles!bids_estimator_id_fkey(name),
        bid_line_items(*)
      `)
      .eq('id', id)
      .single()

    if (!data) return

    const line_items = (data as any).bid_line_items ?? []
    const total_price = line_items.reduce((sum: number, li: any) => sum + (li.price ?? 0), 0)
    openBid({
      ...(data as any),
      estimator_name: (data as any).profiles?.name ?? null,
      line_items,
      total_price,
    })
  }, [openBid])

  if (loading) {
    return (
      <div
        style={{
          height: 'calc(100dvh - 120px)',
          borderRadius: 12,
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text3)',
          fontSize: '0.875rem',
        }}
      >
        Loading map…
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <h1
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Local Jurisdictions Map
        </h1>
        <span
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text3)',
          }}
        >
          {bids.length} Awarded/Verbal {bids.length === 1 ? 'job' : 'jobs'} across {IREX_BRANCHES.length} Irex branches
        </span>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          minHeight: 'calc(100dvh - 120px)',
        }}
      >
        {/* Left: Job list */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <JobListPanel
            bids={bids}
            selectedBidId={selectedBidId}
            hoveredBidId={hoveredBidId}
            onBidHover={handleBidHover}
            onBidClick={handleBidClick}
          />
        </div>

        {/* Right: Map */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <LocalsMap
            bids={bids}
            selectedBidId={selectedBidId}
            hoveredBidId={hoveredBidId}
            onBidHover={handleBidHover}
            onBidClick={handleBidClick}
          />
        </div>
      </div>
    </div>
  )
}
