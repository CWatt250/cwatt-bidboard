'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { useBidDetail } from '@/contexts/bidDetail'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

const UNASSIGNED_VALUE = '__unassigned__'

interface InlineEstimatorCellProps {
  bidId: string
  userId: string | null
  projectName: string
  initialEstimatorId: string | null
  initialEstimatorName: string | null
}

export function InlineEstimatorCell({
  bidId,
  userId,
  projectName,
  initialEstimatorId,
  initialEstimatorName,
}: InlineEstimatorCellProps) {
  const { profiles } = useBidDetail()
  const [optimisticId, setOptimisticId] = useState<string | null>(initialEstimatorId)
  const [saving, setSaving] = useState(false)

  // Reseed only when the upstream value CHANGES, not every render. See
  // InlineStatusCell for the full rationale: the prior "!saving && a !== b"
  // guard clobbered optimistic updates the instant `setSaving(false)` fired,
  // before realtime had a chance to refresh the parent's row.
  const [prevInitialEstimatorId, setPrevInitialEstimatorId] = useState<string | null>(initialEstimatorId)
  if (prevInitialEstimatorId !== initialEstimatorId) {
    setPrevInitialEstimatorId(initialEstimatorId)
    setOptimisticId(initialEstimatorId)
  }

  const nameFor = (id: string | null): string => {
    if (id === null) return 'Unassigned'
    if (id === initialEstimatorId && initialEstimatorName) return initialEstimatorName
    return profiles.find((p) => p.id === id)?.name ?? 'Unknown'
  }

  const displayName = nameFor(optimisticId)
  const isUnassigned = optimisticId === null

  async function handleChange(value: string | null) {
    const nextId = !value || value === UNASSIGNED_VALUE ? null : value
    if (nextId === optimisticId) return

    const prevId = optimisticId
    const prevName = nameFor(prevId)
    const nextName = nameFor(nextId)

    setOptimisticId(nextId)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bids')
      .update({ estimator_id: nextId })
      .eq('id', bidId)

    if (error) {
      setOptimisticId(prevId)
      setSaving(false)
      toast.error('Failed to update estimator.')
      return
    }

    if (userId) {
      await logActivity(
        bidId,
        userId,
        `Changed estimator from ${prevName} to ${nextName} on ${projectName}`,
      )
    }

    setSaving(false)
    toast.success(`Estimator set to ${nextName}.`)
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={optimisticId ?? UNASSIGNED_VALUE}
        onValueChange={handleChange}
        disabled={saving}
      >
        <SelectTrigger
          className="h-6 px-2 py-0 text-xs w-full border-transparent hover:border-input bg-transparent hover:bg-muted/60 rounded"
          aria-label="Change estimator"
        >
          <span
            className={`truncate ${isUnassigned ? 'italic text-muted-foreground' : ''}`}
            title={displayName}
          >
            {displayName}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED_VALUE}>
            <span className="italic text-muted-foreground">Unassigned</span>
          </SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
