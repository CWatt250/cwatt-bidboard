'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BidStatus } from '@/lib/supabase/types'

export interface DuplicateBidMatch {
  id: string
  project_name: string
  branch: string
  status: BidStatus
  bid_due_date: string | null
}

interface UseDuplicateProjectCheckResult {
  matches: DuplicateBidMatch[]
  checking: boolean
}

/**
 * Debounced check for existing bids whose project_name matches the trimmed,
 * case-insensitive input. Returns up to 5 matches. Skips the query when the
 * trimmed name is empty.
 */
export function useDuplicateProjectCheck(
  projectName: string,
  debounceMs: number = 400
): UseDuplicateProjectCheckResult {
  const [matches, setMatches] = useState<DuplicateBidMatch[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const trimmed = projectName.trim()
    if (!trimmed) {
      setMatches([])
      setChecking(false)
      return
    }

    setChecking(true)
    let cancelled = false

    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bids')
        .select('id, project_name, branch, status, bid_due_date')
        .ilike('project_name', trimmed)
        .limit(5)

      if (cancelled) return

      if (error) {
        setMatches([])
      } else {
        setMatches((data ?? []) as DuplicateBidMatch[])
      }
      setChecking(false)
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [projectName, debounceMs])

  return { matches, checking }
}
