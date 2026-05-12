'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

interface ProminentStatusCellProps {
  bidId: string
  userId: string | null
  initialStatus: BidStatus
  onChanged?: () => void
}

export function ProminentStatusCell({
  bidId,
  userId,
  initialStatus,
  onChanged,
}: ProminentStatusCellProps) {
  const [optimistic, setOptimistic] = useState<BidStatus>(initialStatus)
  const [saving, setSaving] = useState(false)

  const [prevInitial, setPrevInitial] = useState<BidStatus>(initialStatus)
  if (prevInitial !== initialStatus) {
    setPrevInitial(initialStatus)
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

    if (userId) {
      await logActivity(bidId, userId, `Status changed from ${prev} to ${next}`)
    }

    setSaving(false)
    toast.success(`Status updated to ${next}.`)
    onChanged?.()
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={optimistic}
        onValueChange={(v) => handleChange(v as BidStatus)}
        disabled={saving}
      >
        <SelectTrigger
          aria-label="Change status"
          className={`h-auto w-full justify-between rounded-full border px-4 py-2 text-base font-bold tracking-tight ${STATUS_BADGE_CLASSES[optimistic]}`}
        >
          <SelectValue />
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
