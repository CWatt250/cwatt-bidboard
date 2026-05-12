'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import type { BidScope } from '@/lib/supabase/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEFAULT_VALUE = '__default__'

interface ActiveProfile {
  id: string
  name: string
}

interface InlineScopeEstimatorCellProps {
  lineItemId: string
  bidId: string
  userId: string | null
  scope: BidScope
  initialEstimatorId: string | null
  /** Bid-level lead estimator — shown as "(default) Lead Name" when scope is null. */
  leadEstimatorName: string | null
}

export function InlineScopeEstimatorCell({
  lineItemId,
  bidId,
  userId,
  scope,
  initialEstimatorId,
  leadEstimatorName,
}: InlineScopeEstimatorCellProps) {
  const [optimistic, setOptimistic] = useState<string | null>(initialEstimatorId)
  const [saving, setSaving] = useState(false)
  const [activeProfiles, setActiveProfiles] = useState<ActiveProfile[]>([])

  // Reseed only when the upstream prop actually changes (same race-condition
  // fix as InlineStatusCell / InlineEstimatorCell).
  const [prevInitial, setPrevInitial] = useState<string | null>(initialEstimatorId)
  if (prevInitial !== initialEstimatorId) {
    setPrevInitial(initialEstimatorId)
    setOptimistic(initialEstimatorId)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setActiveProfiles((data ?? []) as ActiveProfile[])
      })
  }, [])

  async function handleChange(rawNext: string) {
    const next = rawNext === DEFAULT_VALUE ? null : rawNext
    if (next === optimistic) return

    const prev = optimistic
    const prevName = prev
      ? activeProfiles.find((p) => p.id === prev)?.name ?? 'Unknown'
      : leadEstimatorName ?? 'default'
    const nextName = next
      ? activeProfiles.find((p) => p.id === next)?.name ?? 'Unknown'
      : leadEstimatorName ?? 'default'

    setOptimistic(next)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bid_line_items')
      .update({ estimator_id: next })
      .eq('id', lineItemId)

    if (error) {
      setOptimistic(prev)
      setSaving(false)
      toast.error('Failed to update scope estimator.')
      return
    }

    if (userId) {
      const message = next
        ? `Reassigned ${scope} estimator from ${prevName} to ${nextName}`
        : `Reset ${scope} estimator to default (${leadEstimatorName ?? 'unset'})`
      await logActivity(bidId, userId, message)
    }

    setSaving(false)
  }

  const selectedValue = optimistic ?? DEFAULT_VALUE
  const isDefault = optimistic === null
  const displayName = isDefault
    ? leadEstimatorName ?? 'Unassigned'
    : activeProfiles.find((p) => p.id === optimistic)?.name ?? leadEstimatorName ?? 'Unknown'

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={selectedValue}
        onValueChange={(v) => { if (v) handleChange(v) }}
        disabled={saving}
      >
        <SelectTrigger
          className="h-7 px-2 py-0 text-xs w-full justify-between border-transparent hover:border-input bg-transparent hover:bg-muted/60"
          aria-label={`Set ${scope} estimator`}
          title={isDefault ? `Inherits lead: ${displayName}` : `Override: ${displayName}`}
        >
          <SelectValue>
            <span className={isDefault ? 'text-muted-foreground italic truncate' : 'truncate'}>
              {isDefault ? `${displayName} (default)` : displayName}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>
            <span className="italic text-muted-foreground">
              {leadEstimatorName ? `${leadEstimatorName} (default)` : 'Default (inherit)'}
            </span>
          </SelectItem>
          {activeProfiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
