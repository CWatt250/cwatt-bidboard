'use client'

import { useState } from 'react'
import { differenceInCalendarDays, startOfToday } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SCOPE_BADGE_CLASSES, STATUS_BADGE_CLASSES } from '@/config/colors'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'

interface CalendarEventProps {
  event: CalendarEvent
}

function getUrgencyClasses(dueDate: Date): { bg: string; text: string } {
  const days = differenceInCalendarDays(dueDate, startOfToday())
  if (days <= 3) {
    return {
      bg: 'bg-red-500 dark:bg-red-700',
      text: 'text-white',
    }
  }
  if (days <= 7) {
    return {
      bg: 'bg-amber-400 dark:bg-amber-600',
      text: 'text-amber-950 dark:text-white',
    }
  }
  return { bg: '', text: '' }
}

export default function CalendarEventComponent({ event }: CalendarEventProps) {
  const [open, setOpen] = useState(false)
  const { resource: bid } = event
  const urgency = getUrgencyClasses(event.start)

  const scopeClass = SCOPE_BADGE_CLASSES[bid.scope]
  const statusClass = STATUS_BADGE_CLASSES[bid.status]

  return (
    <>
      <button
        className={`w-full text-left px-1 py-0.5 rounded text-xs leading-tight ${urgency.bg} ${urgency.text}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <span className="block font-medium truncate">{bid.project_name}</span>
        <span className="flex gap-1 mt-0.5 flex-wrap">
          <span className={`inline-block rounded border px-1 text-[10px] leading-tight ${scopeClass}`}>
            {bid.scope}
          </span>
          <span className={`inline-block rounded border px-1 text-[10px] leading-tight ${statusClass}`}>
            {bid.status}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bid Detail Coming Soon</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{bid.project_name}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
