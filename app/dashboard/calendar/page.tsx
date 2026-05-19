'use client'

import { useMemo, useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useBids } from '@/hooks/useBids'
import transformBidsToEvents from '@/lib/calendar/transformBidsToEvents'
import CalendarEventComponent from '@/components/calendar/CalendarEvent'
import CalendarToolbar from '@/components/calendar/CalendarToolbar'
import DayBidsDialog from '@/components/calendar/DayBidsDialog'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { useFilters, type Branch, type Status } from '@/contexts/filters'
import { useUserRole } from '@/contexts/userRole'
import { useBidDetail } from '@/contexts/bidDetail'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import { BRANCH_BADGE_CLASSES } from '@/config/colors'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'
import type { Bid } from '@/hooks/useBids'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
})

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const STATUSES: Status[] = ['All', 'Unassigned', 'Bidding', 'In Progress', 'Sent', 'Verbal', 'Awarded', 'Lost']

const selectStyle: React.CSSProperties = {
  height: 32,
  padding: '0 28px 0 8px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238892b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
}

function DateHeader({ date, label }: { date: Date; label: string }) {
  const today = new Date()
  const isToday = isSameDay(date, today)
  return (
    <span
      style={{
        fontWeight: isToday ? 700 : 500,
        color: isToday ? '#2563EB' : 'inherit',
        fontSize: isToday ? '0.85rem' : '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1.2,
      }}
    >
      {isToday && (
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB' }}>
          Today
        </span>
      )}
      {label}
    </span>
  )
}

export default function CalendarPage() {
  // Calendar is branch-wide: bids in the user's branch(es), regardless of
  // estimator assignment. Branch-level filter still applies via useBids.
  const { bids, loading } = useBids({ skipEstimatorSelfFilter: true })

  const { branch, status, setBranch, setStatus } = useFilters()
  const [estimator, setEstimator] = useState<string>('All')
  const { isAdmin, branches: userBranches } = useUserRole()
  const { profiles } = useBidDetail()

  // Apply the local Estimator filter on top of the branch- and status-filtered
  // bids that useBids already returned.
  const visibleBids = useMemo(() => {
    if (estimator === 'All') return bids
    return bids.filter((b) => b.estimator_id === estimator)
  }, [bids, estimator])

  const events = useMemo(() => transformBidsToEvents(visibleBids), [visibleBids])

  // Week view has taller cells, so it keeps the full event list.
  const [view, setView] = useState<View>('month')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDayBids, setSelectedDayBids] = useState<Bid[]>([])

  const openDayDialog = useCallback(
    (date: Date, dayBids: Bid[]) => {
      setSelectedDate(date)
      setSelectedDayBids(dayBids)
      setDialogOpen(true)
    },
    []
  )

  const bidsByDay = useCallback(
    (date: Date): Bid[] =>
      events
        .filter((e) => isSameDay(e.start, date))
        .map((e) => e.resource),
    [events]
  )

  const dayPropGetter = useCallback((date: Date) => {
    if (isSameDay(date, new Date())) {
      return {
        className: 'rbc-day-today-highlight',
        style: {
          backgroundColor: '#EFF6FF',
          boxShadow: 'inset 0 0 0 2px #2563EB',
        },
      }
    }
    return {}
  }, [])

  // Branch filter: admin sees all 5; non-admin sees only their assigned branches.
  const branchOptions: { value: Branch; label: string }[] = isAdmin
    ? [
        { value: 'All', label: 'All Branches' },
        ...ALL_BRANCHES.map((b) => ({
          value: b,
          label: (BRANCH_LABELS as Record<string, string>)[b] ?? b,
        })),
      ]
    : [
        { value: 'All', label: 'All My Branches' },
        ...userBranches.map((b) => ({
          value: b as Branch,
          label: BRANCH_LABELS[b] ?? b,
        })),
      ]

  // Estimator filter shows the full list of estimators regardless of viewer role.
  const estimatorOptions = profiles

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Calendar</h1>
        <NewBidDialog />
      </div>

      {/* Filter toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          Filters
        </span>

        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value as Branch)}
          style={selectStyle}
          aria-label="Filter by branch"
        >
          {branchOptions.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>

        <select
          value={estimator}
          onChange={(e) => setEstimator(e.target.value)}
          style={selectStyle}
          aria-label="Filter by estimator"
        >
          <option value="All">All Estimators</option>
          {estimatorOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          style={selectStyle}
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
          ))}
        </select>
      </div>

      {/* Branch color legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: 11,
          padding: '6px 0',
        }}
      >
        {ALL_BRANCHES.map((b) => (
          <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden
              className={`border ${BRANCH_BADGE_CLASSES[b]}`}
              style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, flexShrink: 0 }}
            />
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{b}</span>
            <span style={{ color: 'var(--text3)' }}>
              — {(BRANCH_LABELS as Record<string, string>)[b]}
            </span>
          </span>
        ))}
      </div>

      {/* Calendar */}
      <div className="rbc-wrapper flex-1 min-h-[1600px] p-4" style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading…
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            views={[Views.MONTH, Views.WEEK]}
            style={{ height: '100%', minHeight: 1600 }}
            popup
            dayPropGetter={dayPropGetter}
            components={{
              event: CalendarEventComponent,
              toolbar: CalendarToolbar,
              month: {
                dateHeader: DateHeader,
              },
            }}
            eventPropGetter={() => ({
              // Let CalendarEvent handle its own background; suppress default blue
              style: { background: 'transparent', border: 'none', padding: 0 },
            })}
            onShowMore={(shownEvents, date) => {
              openDayDialog(
                date,
                (shownEvents as CalendarEvent[]).map((e) => e.resource)
              )
            }}
            onDrillDown={(date) => {
              const dayBids = bidsByDay(date)
              if (dayBids.length > 0) {
                openDayDialog(date, dayBids)
              }
            }}
          />
        )}
      </div>

      <DayBidsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={selectedDate}
        bids={selectedDayBids}
      />

      <style>{`
        .rbc-wrapper .rbc-show-more {
          display: inline-block;
          margin: 2px 4px 0;
          padding: 2px 8px;
          border-radius: 999px;
          background: #DBEAFE;
          color: #1D4ED8;
          font-size: 0.65rem;
          font-weight: 600;
          border: 1px solid #BFDBFE;
          cursor: pointer;
          transition: background 150ms ease;
        }
        .rbc-wrapper .rbc-show-more:hover {
          background: #BFDBFE;
          color: #1E40AF;
        }
      `}</style>

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
      </div>
    </div>
  )
}
