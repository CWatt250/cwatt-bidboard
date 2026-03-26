'use client'

import { useMemo } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useBids } from '@/hooks/useBids'
import transformBidsToEvents from '@/lib/calendar/transformBidsToEvents'
import CalendarEventComponent from '@/components/calendar/CalendarEvent'
import CalendarToolbar from '@/components/calendar/CalendarToolbar'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
})

export default function CalendarPage() {
  const { bids, loading } = useBids()
  const events = useMemo(() => transformBidsToEvents(bids), [bids])

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <NewBidDialog />
      </div>

      {/* Calendar */}
      <div className="rbc-wrapper flex-1 min-h-[600px] rounded-lg border border-border bg-card p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading…
          </div>
        ) : (
          <Calendar<CalendarEvent>
            localizer={localizer}
            events={events}
            defaultView={Views.MONTH}
            views={[Views.MONTH, Views.WEEK]}
            style={{ height: '100%', minHeight: 600 }}
            components={{
              event: CalendarEventComponent,
              toolbar: CalendarToolbar,
            }}
            eventPropGetter={() => ({
              // Let CalendarEvent handle its own background; suppress default blue
              style: { background: 'transparent', border: 'none', padding: 0 },
            })}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground px-1 pb-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Due within 3 days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
          Due within 7 days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-primary" />
          On track
        </span>
      </div>
    </div>
  )
}
