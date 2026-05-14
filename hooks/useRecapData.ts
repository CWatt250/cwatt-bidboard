'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import type { Bid, BidClient, BidLineItem } from '@/lib/supabase/types'

interface UseRecapDataResult {
  bids: Bid[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function mapBidRow(row: any): Bid {
  const line_items: BidLineItem[] = (row.bid_line_items ?? []).map((li: any) => ({
    ...li,
    estimator_name: li.estimator?.name ?? null,
  }))
  const clients: BidClient[] = row.bid_clients ?? []
  const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
  return {
    ...row,
    estimator_name: row.profiles?.name ?? null,
    line_items,
    clients,
    total_price,
  }
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Pulls every bid needed by the Recaps page (Weekly + Custom + Insights) in a
 * single round-trip. Window is six months back to three months forward — wide
 * enough for week-over-week comparisons and short-term forecasting without
 * dragging the entire bid history into the browser.
 *
 * RLS handles branch scoping; non-admin users only receive bids in their
 * user_branches.
 */
export function useRecapData(): UseRecapDataResult {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelId = useId()

  const {
    isAdmin,
    isBranchManager,
    isEstimator,
    branches: userBranches,
    loading: roleLoading,
  } = useUserRole()

  const fetchBids = useCallback(async () => {
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const threeMonthsAhead = new Date(now)
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

    const supabase = createClient()
    let query = supabase
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
        bid_line_items(*, estimator:profiles!bid_line_items_estimator_id_fkey(name)),
        bid_clients(*, clients(name))
      `)
      .gte('bid_due_date', toYmd(sixMonthsAgo))
      .lte('bid_due_date', toYmd(threeMonthsAhead))
      .order('bid_due_date', { ascending: false })

    // Defense-in-depth role filtering on top of RLS.
    if ((isEstimator || isBranchManager) && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setBids((data ?? []).map(mapBidRow))
    setError(null)
  }, [isAdmin, isBranchManager, isEstimator, userBranches])

  useEffect(() => {
    if (roleLoading) return
    setLoading(true)
    fetchBids().finally(() => setLoading(false))
  }, [fetchBids, roleLoading])

  useEffect(() => {
    if (roleLoading) return
    const supabase = createClient()
    const channel = supabase
      .channel(`recap-data-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        fetchBids()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_line_items' }, () => {
        fetchBids()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_clients' }, () => {
        fetchBids()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBids, roleLoading, channelId])

  return { bids, loading, error, refetch: fetchBids }
}
