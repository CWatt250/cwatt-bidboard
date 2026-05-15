'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const LocalsMap = dynamic(() => import('./LocalsMap'), { ssr: false })

export interface MapBid {
  id: string
  project_name: string
  branch: string
  status: string
  total_price: number | null
  latitude: number
  longitude: number
}

export function MapPageClient() {
  const [bids, setBids] = useState<MapBid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('bids')
      .select('id, project_name, branch, status, latitude, longitude, bid_line_items(price)')
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
          bid_line_items: { price: number | null }[]
        }[]).map((b) => ({
          id: b.id,
          project_name: b.project_name,
          branch: b.branch,
          status: b.status,
          latitude: b.latitude,
          longitude: b.longitude,
          total_price: b.bid_line_items.reduce<number | null>((sum, li) => {
            if (li.price == null) return sum
            return (sum ?? 0) + li.price
          }, null),
        }))
        setBids(rows)
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '16px',
        }}
      >
        Local Jurisdictions Map
      </h1>

      {loading ? (
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
      ) : (
        <LocalsMap bids={bids} />
      )}
    </div>
  )
}
