'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { STATUS_BADGE_CLASSES } from '@/config/colors'
import type { BidStatus } from '@/lib/supabase/types'

const ALL_STATUSES: BidStatus[] = [
  'Unassigned',
  'Bidding',
  'In Progress',
  'Sent',
  'Verbal',
  'Awarded',
  'Lost',
]

interface InlineStatusCellProps {
  bidId: string
  userId: string | null
  projectName: string
  initialStatus: BidStatus
  /** Called after a successful Supabase save so callers can patch local state. */
  onSaved?: (status: BidStatus) => void
}

export function InlineStatusCell({
  bidId,
  userId,
  projectName,
  initialStatus,
  onSaved,
}: InlineStatusCellProps) {
  const [optimistic, setOptimistic] = useState<BidStatus>(initialStatus)
  const [saving, setSaving] = useState(false)

  // Reseed only when the upstream value CHANGES, not every render. The previous
  // implementation reseeded whenever `initialStatus !== optimistic` and `!saving`,
  // which clobbered the optimistic value the instant `setSaving(false)` ran —
  // before useBids' realtime event landed and refreshed the parent's row data.
  // Tracking the last-seen prop value via state lets us distinguish "prop just
  // changed (trust it)" from "prop is the same stale value as before (ignore)".
  const [prevInitialStatus, setPrevInitialStatus] = useState<BidStatus>(initialStatus)
  if (prevInitialStatus !== initialStatus) {
    setPrevInitialStatus(initialStatus)
    setOptimistic(initialStatus)
  }

  async function handleChange(next: BidStatus) {
    if (next === optimistic) return
    const prev = optimistic
    setOptimistic(next)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bids')
      .update({ status: next })
      .eq('id', bidId)

    if (error) {
      setOptimistic(prev)
      setSaving(false)
      toast.error('Failed to update status.')
      return
    }

    // Reflect the saved status in the parent's row data instantly so the
    // status filter and sort pick it up without waiting on a refetch.
    onSaved?.(next)

    if (userId) {
      await logActivity(
        bidId,
        userId,
        `Updated status from ${prev} to ${next} on ${projectName}`,
      )
    }

    setSaving(false)
    toast.success(`Status updated to ${next}.`)
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={optimistic}
        onValueChange={(v) => handleChange(v as BidStatus)}
        disabled={saving}
      >
        <SelectTrigger
          className={`h-6 px-2 py-0 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASSES[optimistic]} w-auto gap-1`}
          aria-label="Change status"
        >
          <Badge
            className={`${STATUS_BADGE_CLASSES[optimistic]} border-0 px-0 py-0 bg-transparent`}
            variant="outline"
          >
            {optimistic}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          {ALL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${STATUS_BADGE_CLASSES[s].split(' ')[0]}`}
                />
                {s}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
