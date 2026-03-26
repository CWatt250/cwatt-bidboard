'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFilters } from '@/contexts/filters'

export type BidStatus = 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent'
export type BidScope = 'Ductwork' | 'Piping' | 'Firestop' | 'Combo'
export type BidBranch = 'Branch 1' | 'Branch 2' | 'Branch 3' | 'Branch 4' | 'Branch 5'

export interface Bid {
  id: string
  project_name: string
  client: string
  scope: BidScope
  branch: BidBranch
  estimator_id: string | null
  estimator_name: string | null
  bid_price: number | null
  status: BidStatus
  bid_due_date: string
  project_start_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
        client,
        scope,
        branch,
        estimator_id,
        bid_price,
        status,
        bid_due_date,
        project_start_date,
        notes,
        created_at,
        updated_at,
        profiles!bids_estimator_id_fkey(name)
      `)
      .order('created_at', { ascending: false })

    if (branch !== 'All') query = query.eq('branch', branch)
    if (scope !== 'All') query = query.eq('scope', scope)
    if (status !== 'All') query = query.eq('status', status)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const mapped: Bid[] = (data ?? []).map((row: any) => ({
      ...row,
      estimator_name: row.profiles?.name ?? null,
    }))

    const filtered =
      estimator !== 'All'
        ? mapped.filter((b) => b.estimator_name === estimator)
        : mapped

    setBids(filtered)
    setError(null)
  }, [branch, estimator, scope, status])

  useEffect(() => {
    setLoading(true)
    fetchBids().finally(() => setLoading(false))
  }, [fetchBids])

  useEffect(() => {
    const supabase = createClient()

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

          const { data } = await supabase
            .from('bids')
            .select(`
              id,
              project_name,
              client,
              scope,
              branch,
              estimator_id,
              bid_price,
              status,
              bid_due_date,
              project_start_date,
              notes,
              created_at,
              updated_at,
              profiles!bids_estimator_id_fkey(name)
            `)
            .eq('id', payload.new.id)
            .single()

          if (!data) return

          const bid: Bid = { ...(data as any), estimator_name: (data as any).profiles?.name ?? null }

          if (payload.eventType === 'INSERT') {
            setBids((prev) => [bid, ...prev])
          } else {
            setBids((prev) => prev.map((b) => (b.id === bid.id ? bid : b)))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { bids, loading, error }
}
