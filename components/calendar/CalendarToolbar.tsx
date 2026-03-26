'use client'

import { Navigate, Views } from 'react-big-calendar'
import type { ToolbarProps, View } from 'react-big-calendar'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'

export default function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
}: ToolbarProps<CalendarEvent, object>) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          aria-label="Previous"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(Navigate.TODAY)}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate(Navigate.NEXT)}
          aria-label="Next"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Current period label */}
      <span className="text-base font-semibold text-foreground">{label}</span>

      {/* View toggle */}
      <div className="flex items-center gap-1">
        <Button
          variant={view === Views.MONTH ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.MONTH as View)}
        >
          Month
        </Button>
        <Button
          variant={view === Views.WEEK ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.WEEK as View)}
        >
          Week
        </Button>
      </div>
    </div>
  )
}
