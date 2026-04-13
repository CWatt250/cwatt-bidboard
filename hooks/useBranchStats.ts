'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Branch } from '@/lib/supabase/types'

export interface BranchStats {
  code: Branch
  activeUsers: number
  activeBids: number
}

const BRANCH_CODES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

/**
 * Counts active users (via user_branches → profiles.is_active)
 * and active bids (status != 'Lost' and != 'Awarded') per branch.
 */
export function useBranchStats() {
  const [stats, setStats] = useState<Record<Branch, BranchStats>>(() => {
    const empty: Record<string, BranchStats> = {}
    for (const code of BRANCH_CODES) {
      empty[code] = { code, activeUsers: 0, activeBids: 0 }
    }
    return empty as Record<Branch, BranchStats>
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Active users per branch — join profiles (is_active=true)
    const { data: userRows } = await supabase
      .from('user_branches')
      .select('branch, profiles!inner(is_active)')

    // Active bids per branch (status != Lost, != Awarded)
    const { data: bidRows } = await supabase
      .from('bids')
      .select('branch, status')
      .not('status', 'in', '("Lost","Awarded")')

    const next: Record<string, BranchStats> = {}
    for (const code of BRANCH_CODES) {
      next[code] = { code, activeUsers: 0, activeBids: 0 }
    }

    if (userRows) {
      for (const row of userRows as Array<{ branch: Branch; profiles: { is_active: boolean } | { is_active: boolean }[] }>) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        if (profile?.is_active && next[row.branch]) {
          next[row.branch].activeUsers += 1
        }
      }
    }

    if (bidRows) {
      for (const row of bidRows as Array<{ branch: Branch }>) {
        if (next[row.branch]) next[row.branch].activeBids += 1
      }
    }

    setStats(next as Record<Branch, BranchStats>)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  return { stats, loading, refetch: fetchStats }
}

/** Users assigned to a branch (active only, for the drawer). */
export function useUsersByBranch(branch: Branch | null) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branch) { setUsers([]); return }

    let cancelled = false
    async function fetch() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('user_branches')
        .select('profiles!inner(id, name, role, is_active)')
        .eq('branch', branch)

      if (cancelled) return

      const mapped: Array<{ id: string; name: string; role: string }> = []
      for (const row of (data ?? []) as Array<{ profiles: { id: string; name: string; role: string; is_active: boolean } | { id: string; name: string; role: string; is_active: boolean }[] }>) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        if (profile?.is_active) {
          mapped.push({ id: profile.id, name: profile.name, role: profile.role })
        }
      }
      mapped.sort((a, b) => a.name.localeCompare(b.name))
      setUsers(mapped)
      setLoading(false)
    }
    fetch()
    return () => { cancelled = true }
  }, [branch])

  return { users, loading }
}
