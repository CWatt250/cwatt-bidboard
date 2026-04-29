'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import type { Bid, BidLineItem, BidClient } from '@/lib/supabase/types'

export interface BidActivity {
  id: string
  bid_id: string
  user_id: string | null
  action: string
  created_at: string
  author_name: string | null
}

export interface BidNote {
  id: string
  bid_id: string
  user_id: string | null
  text: string
  created_at: string
  author_name: string | null
}

interface UseBidResult {
  bid: Bid | null
  activity: BidActivity[]
  notes: BidNote[]
  loading: boolean
  error: string | null
  notFound: boolean
  refetch: () => Promise<void>
}

export function useBid(id: string): UseBidResult {
  const [bid, setBid] = useState<Bid | null>(null)
  const [activity, setActivity] = useState<BidActivity[]>([])
  const [notes, setNotes] = useState<BidNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const {
    isAdmin,
    isBranchManager,
    isEstimator,
    branches: userBranches,
    profile,
    loading: roleLoading,
  } = useUserRole()

  const fetchBid = useCallback(async () => {
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
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
        bid_line_items(*),
        bid_clients(*, clients(name))
      `)
      .eq('id', id)
      .single()

    if (fetchError || !data) {
      setNotFound(true)
      setError(fetchError?.message ?? 'Bid not found')
      return
    }

    // Defense-in-depth role check (RLS handles DB-level, this is application-level)
    const bidData = data as any
    if (isEstimator && profile) {
      const inBranch = userBranches.includes(bidData.branch)
      const isOwn =
        bidData.estimator_id === profile.id || bidData.estimator_id === null
      if (!inBranch || !isOwn) {
        setNotFound(true)
        return
      }
    } else if (isBranchManager && userBranches.length > 0) {
      if (!userBranches.includes(bidData.branch)) {
        setNotFound(true)
        return
      }
    }

    const line_items: BidLineItem[] = bidData.bid_line_items ?? []
    const clients: BidClient[] = bidData.bid_clients ?? []
    const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
    setBid({
      ...bidData,
      estimator_name: bidData.profiles?.name ?? null,
      line_items,
      clients,
      total_price,
    })
    setNotFound(false)
    setError(null)

    // Fetch activity log — graceful if table doesn't exist yet
    const { data: actData } = await supabase
      .from('bid_activity')
      .select('id, bid_id, user_id, action, created_at, profiles(name)')
      .eq('bid_id', id)
      .order('created_at', { ascending: false })

    setActivity(
      (actData ?? []).map((a: any) => ({
        id: a.id,
        bid_id: a.bid_id,
        user_id: a.user_id,
        action: a.action,
        created_at: a.created_at,
        author_name: a.profiles?.name ?? null,
      }))
    )

    // Fetch notes — graceful if table doesn't exist yet
    const { data: notesData } = await supabase
      .from('bid_notes')
      .select('id, bid_id, user_id, text, created_at, profiles(name)')
      .eq('bid_id', id)
      .order('created_at', { ascending: false })

    setNotes(
      (notesData ?? []).map((n: any) => ({
        id: n.id,
        bid_id: n.bid_id,
        user_id: n.user_id,
        text: n.text,
        created_at: n.created_at,
        author_name: n.profiles?.name ?? null,
      }))
    )
  }, [id, isAdmin, isBranchManager, isEstimator, userBranches, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (roleLoading) return
    setLoading(true)
    fetchBid().finally(() => setLoading(false))
  }, [fetchBid, roleLoading])

  // Real-time subscriptions
  useEffect(() => {
    if (roleLoading) return
    const supabase = createClient()

    const channel = supabase
      .channel(`bid-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bids', filter: `id=eq.${id}` },
        () => fetchBid()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_line_items', filter: `bid_id=eq.${id}` },
        () => fetchBid()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_activity', filter: `bid_id=eq.${id}` },
        () => fetchBid()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_notes', filter: `bid_id=eq.${id}` },
        () => fetchBid()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_clients', filter: `bid_id=eq.${id}` },
        () => fetchBid()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, fetchBid, roleLoading])

  return { bid, activity, notes, loading, error, notFound, refetch: fetchBid }
}
