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
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Calendar</h1>
        <NewBidDialog />
      </div>

      {/* Calendar */}
      <div className="rbc-wrapper flex-1 min-h-[600px] p-4" style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: 'var(--text3)', padding: '0 4px 8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', height: 10, width: 10, borderRadius: '50%', background: 'var(--red)' }} />
          Due within 3 days
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', height: 10, width: 10, borderRadius: '50%', background: 'var(--yellow)' }} />
          Due within 7 days
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', height: 10, width: 10, borderRadius: '50%', background: 'var(--accent)' }} />
          On track
        </span>
      </div>
    </div>
  )
}
