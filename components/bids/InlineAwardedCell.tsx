'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import type { BidScope, BidStatus } from '@/lib/supabase/types'

interface InlineAwardedCellProps {
  lineItemId: string
  bidId: string
  bidStatus: BidStatus
  userId: string | null
  scope: BidScope
  initialIsAwarded: boolean
}

export function InlineAwardedCell({
  lineItemId,
  bidId,
  bidStatus,
  userId,
  scope,
  initialIsAwarded,
}: InlineAwardedCellProps) {
  const [optimistic, setOptimistic] = useState<boolean>(initialIsAwarded)
  const [saving, setSaving] = useState(false)

  // Reseed only when the upstream prop actually changes — same race-condition
  // fix as InlineStatusCell. Prevents the realtime refresh from clobbering an
  // in-flight optimistic toggle.
  const [prevInitial, setPrevInitial] = useState<boolean>(initialIsAwarded)
  if (prevInitial !== initialIsAwarded) {
    setPrevInitial(initialIsAwarded)
    setOptimistic(initialIsAwarded)
  }

  async function handleToggle(next: boolean) {
    if (next === optimistic) return
    const prev = optimistic
    setOptimistic(next)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bid_line_items')
      .update({ is_awarded: next })
      .eq('id', lineItemId)

    if (error) {
      setOptimistic(prev)
      setSaving(false)
      toast.error('Failed to update awarded status.')
      return
    }

    // When the first scope is awarded but the parent bid isn't yet, silently
    // bump the bid to Awarded — you can't win a scope on a non-awarded bid.
    // Unchecking the last scope intentionally does NOT flip the bid back.
    if (next && bidStatus !== 'Awarded') {
      const { error: bidErr } = await supabase
        .from('bids')
        .update({ status: 'Awarded' })
        .eq('id', bidId)
      if (!bidErr && userId) {
        await logActivity(
          bidId,
          userId,
          `Status changed from ${bidStatus} to Awarded (auto: scope awarded)`,
        )
      }
    }

    if (userId) {
      await logActivity(
        bidId,
        userId,
        next ? `Marked ${scope} as awarded` : `Unmarked ${scope} as awarded`,
      )
    }

    setSaving(false)
  }

  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center cursor-pointer"
      title={optimistic ? 'Awarded — click to unmark' : 'Not awarded — click to mark'}
    >
      <input
        type="checkbox"
        checked={optimistic}
        disabled={saving}
        onChange={(e) => handleToggle(e.target.checked)}
        aria-label={`Mark ${scope} awarded`}
        style={{
          width: 16,
          height: 16,
          cursor: saving ? 'not-allowed' : 'pointer',
          accentColor: 'var(--green, #16a34a)',
        }}
      />
    </label>
  )
}
