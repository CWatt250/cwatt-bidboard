'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFilters } from '@/contexts/filters'
import { useUserRole } from '@/contexts/userRole'

// Re-export types from canonical location for backwards compatibility
export type { BidStatus, BidScope, BidBranch, BidLineItem, BidClient, Bid } from '@/lib/supabase/types'
import type { Bid, BidLineItem, BidClient } from '@/lib/supabase/types'

interface UseBidsResult {
  bids: Bid[]
  loading: boolean
  error: string | null
}

export function useBids(): UseBidsResult {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { branch, scope, status } = useFilters()
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile } = useUserRole()

  const fetchBids = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('bids')
      .select(`
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
      `)
      .order('created_at', { ascending: false })

    if (branch !== 'All') query = query.eq('branch', branch)
    if (status !== 'All') query = query.eq('status', status)

    // Defense-in-depth role filtering on top of RLS
    if (isEstimator && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    } else if (isBranchManager && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }
    // Admin: no additional filter

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const mapped: Bid[] = (data ?? []).map((row: any) => {
      const line_items: BidLineItem[] = row.bid_line_items ?? []
      const clients: BidClient[] = row.bid_clients ?? []
      const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
      return {
        ...row,
        estimator_name: row.profiles?.name ?? null,
        line_items,
        clients,
        total_price,
      }
    })

    let filtered = mapped

    // Estimator: further filter to own bids only (estimator_id matches or unassigned)
    if (isEstimator && profile) {
      filtered = filtered.filter((b) => b.estimator_id === profile.id || b.estimator_id === null)
    }

    // Scope filter: keep bids that have at least one line item matching the scope
    if (scope !== 'All') {
      filtered = filtered.filter((b) =>
        b.line_items?.some((li) => li.scope === scope)
      )
    }

    setBids(filtered)
    setError(null)
  }, [branch, scope, status, isAdmin, isBranchManager, isEstimator, userBranches, profile])

  useEffect(() => {
    setLoading(true)
    fetchBids().finally(() => setLoading(false))
  }, [fetchBids])

  useEffect(() => {
    const supabase = createClient()

    async function fetchSingleBid(bidId: string): Promise<Bid | null> {
      const { data } = await supabase
        .from('bids')
        .select(`
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
        `)
        .eq('id', bidId)
        .single()

      if (!data) return null
      const line_items: BidLineItem[] = (data as any).bid_line_items ?? []
      const clients: BidClient[] = (data as any).bid_clients ?? []
      const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
      return {
        ...(data as any),
        estimator_name: (data as any).profiles?.name ?? null,
        line_items,
        clients,
        total_price,
      }
    }

    const channel = supabase
      .channel('bids-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids' },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setBids((prev) => prev.filter((b) => b.id !== payload.old.id))
            return
          }

          const bid = await fetchSingleBid(payload.new.id)
          if (!bid) return

          if (payload.eventType === 'INSERT') {
            setBids((prev) => [bid, ...prev])
          } else {
            setBids((prev) => prev.map((b) => (b.id === bid.id ? bid : b)))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_line_items' },
        async (payload) => {
          const bidId =
            payload.eventType === 'DELETE'
              ? (payload.old as any).bid_id
              : (payload.new as any).bid_id
          if (!bidId) return

          const bid = await fetchSingleBid(bidId)
          if (!bid) return
          setBids((prev) => prev.map((b) => (b.id === bid.id ? bid : b)))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_clients' },
        async (payload) => {
          const bidId =
            payload.eventType === 'DELETE'
              ? (payload.old as any).bid_id
              : (payload.new as any).bid_id
          if (!bidId) return

          const bid = await fetchSingleBid(bidId)
          if (!bid) return
          setBids((prev) => prev.map((b) => (b.id === bid.id ? bid : b)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { bids, loading, error }
}
