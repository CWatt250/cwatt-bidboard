'use client'

import { useState } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface InlineDateCellProps {
  bidId: string
  userId: string | null
  projectName: string
  initialDate: string | null
  displayClassName?: string
  displayStyle?: React.CSSProperties
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(iso: string | null): string {
  if (!iso) return '—'
  return format(parseISO(iso + 'T00:00:00'), 'MMM d, yyyy')
}

function formatActivityDate(iso: string | null): string {
  if (!iso) return 'unset'
  return format(parseISO(iso + 'T00:00:00'), 'MMM d')
}

function CalendarGrid({
  selectedIso,
  onSelect,
}: {
  selectedIso: string | null
  onSelect: (iso: string | null) => void
}) {
  const initialMonth = selectedIso ? parseISO(selectedIso + 'T00:00:00') : new Date()
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(initialMonth))

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    days.push(new Date(d))
  }

  const today = new Date()
  const selected = selectedIso ? parseISO(selectedIso + 'T00:00:00') : null

  return (
    <div className="p-3 select-none" style={{ width: 260 }}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1 rounded hover:bg-muted/60"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="text-sm font-medium">{format(viewMonth, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-muted/60"
          aria-label="Next month"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const isSelected = selected ? isSameDay(day, selected) : false
          const isToday = isSameDay(day, today)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(toISODate(day))}
              className={
                'h-7 w-7 text-xs rounded transition-colors ' +
                (isSelected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : inMonth
                    ? 'hover:bg-muted/60 text-foreground'
                    : 'text-muted-foreground/50 hover:bg-muted/40') +
                (isToday && !isSelected ? ' ring-1 ring-primary/40' : '')
              }
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 pt-2 border-t">
        <button
          type="button"
          onClick={() => onSelect(toISODate(new Date()))}
          className="text-xs text-primary hover:underline"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs text-muted-foreground hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export function InlineDateCell({
  bidId,
  userId,
  projectName,
  initialDate,
  displayClassName,
  displayStyle,
}: InlineDateCellProps) {
  const [open, setOpen] = useState(false)
  const [optimistic, setOptimistic] = useState<string | null>(initialDate)
  const [saving, setSaving] = useState(false)

  // Reseed only when the upstream value CHANGES, not every render. See
  // InlineStatusCell for the full rationale: the prior reseed-on-every-render
  // logic clobbered the optimistic value the instant `setSaving(false)` /
  // `setOpen(false)` fired, before realtime updated the parent's row.
  const [prevInitialDate, setPrevInitialDate] = useState<string | null>(initialDate)
  if (prevInitialDate !== initialDate) {
    setPrevInitialDate(initialDate)
    setOptimistic(initialDate)
  }

  async function save(next: string | null) {
    setOpen(false)
    if (next === optimistic) return

    const prev = optimistic
    setOptimistic(next)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bids')
      .update({ bid_due_date: next })
      .eq('id', bidId)

    if (error) {
      setOptimistic(prev)
      setSaving(false)
      toast.error('Failed to update bid due date.')
      return
    }

    if (userId) {
      await logActivity(
        bidId,
        userId,
        `Updated bid due date from ${formatActivityDate(prev)} to ${formatActivityDate(next)} on ${projectName}`,
      )
    }

    setSaving(false)
    toast.success('Bid due date updated.')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            disabled={saving}
            title="Click to edit bid due date"
            className={
              displayClassName ??
              'block w-full text-left truncate rounded px-1 -mx-1 hover:bg-muted/60 transition-colors'
            }
            style={displayStyle}
          >
            {formatDisplay(optimistic)}
          </button>
        }
      />
      <PopoverContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="p-0"
      >
        <CalendarGrid selectedIso={optimistic} onSelect={save} />
      </PopoverContent>
    </Popover>
  )
}
