'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFilters } from '@/contexts/filters'

export type BidStatus = 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent' | 'Awarded' | 'Lost'
export type BidScope = 'Plumbing Piping' | 'HVAC Piping' | 'HVAC Ductwork' | 'Fire Stopping' | 'Equipment' | 'Other'
export type BidBranch = 'PSC' | 'SEA' | 'POR' | 'PHX' | 'SLC'

export interface BidLineItem {
  id: string
  bid_id: string
  client: string
  scope: BidScope
  price: number | null
  created_at: string
  updated_at: string
}

export interface Bid {
  id: string
  project_name: string
  branch: BidBranch
  estimator_id: string | null
  estimator_name: string | null
  status: BidStatus
  bid_due_date: string
  project_start_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  line_items?: BidLineItem[]
  total_price?: number // computed: sum of all line item prices
}

interface UseBidsResult {
  bids: Bid[]
  loading: boolean
  error: string | null
}

export function useBids(): UseBidsResult {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { branch, estimator, scope, status } = useFilters()

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
        bid_line_items(*)
      `)
      .order('created_at', { ascending: false })

    if (branch !== 'All') query = query.eq('branch', branch)
    if (status !== 'All') query = query.eq('status', status)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const mapped: Bid[] = (data ?? []).map((row: any) => {
      const line_items: BidLineItem[] = row.bid_line_items ?? []
      const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
      return {
        ...row,
        estimator_name: row.profiles?.name ?? null,
        line_items,
        total_price,
      }
    })

    let filtered = estimator !== 'All'
      ? mapped.filter((b) => b.estimator_name === estimator)
      : mapped

    // Scope filter: keep bids that have at least one line item matching the scope
    if (scope !== 'All') {
      filtered = filtered.filter((b) =>
        b.line_items?.some((li) => li.scope === scope)
      )
    }

    setBids(filtered)
    setError(null)
  }, [branch, estimator, scope, status])

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
          bid_line_items(*)
        `)
        .eq('id', bidId)
        .single()

      if (!data) return null
      const line_items: BidLineItem[] = (data as any).bid_line_items ?? []
      const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
      return {
        ...(data as any),
        estimator_name: (data as any).profiles?.name ?? null,
        line_items,
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { bids, loading, error }
}
