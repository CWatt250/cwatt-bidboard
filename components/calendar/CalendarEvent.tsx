'use client'

import { useState } from 'react'
import { differenceInCalendarDays, format, startOfToday } from 'date-fns'
import { useBidDetail } from '@/contexts/bidDetail'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'
import type { Bid, BidStatus } from '@/hooks/useBids'
import { cn } from '@/lib/utils'
import {
  BRANCH_BADGE_CLASSES,
  SCOPE_ABBREVIATIONS,
  SCOPE_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
} from '@/config/colors'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Month view shows at most this many bid cards per day; the rest collapse
 *  into a single "+N more" overflow event. */
export const MONTH_VIEW_EVENT_CAP = 3

const STATUS_COLORS: Record<BidStatus, { bg: string; border: string; text: string }> = {
  Unassigned:    { bg: 'rgba(136,146,176,0.12)', border: '#8892b0', text: '#4a5270' },
  Bidding:       { bg: 'rgba(56,189,248,0.12)',  border: '#38bdf8', text: '#0ea5e9' },
  'In Progress': { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b', text: '#d97706' },
  Sent:          { bg: 'rgba(16,185,129,0.12)',  border: '#10b981', text: '#059669' },
  Verbal:        { bg: 'rgba(139,92,246,0.12)',  border: '#8b5cf6', text: '#7c3aed' },
  Awarded:       { bg: 'rgba(16,185,129,0.15)',  border: '#10b981', text: '#047857' },
  Lost:          { bg: 'rgba(239,68,68,0.1)',    border: '#ef4444', text: '#dc2626' },
}

// Unassigned overrides — rose/red color
const UNASSIGNED_COLORS = {
  bg: 'rgba(251,113,133,0.12)',
  border: '#fb7185',
  text: '#e11d48',
}

/** Short status labels for the on-card status indicator. */
const STATUS_LABELS: Record<BidStatus, string> = {
  Unassigned: 'UNASSGN',
  Bidding: 'BIDDING',
  'In Progress': 'IN PROG',
  Sent: 'SENT',
  Verbal: 'VERBAL',
  Awarded: 'AWARDED',
  Lost: 'LOST',
}

/** Shared pill styling for branch + scope chips. */
const CHIP_CLASS =
  'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none'

/**
 * The text-color utilities pulled out of a STATUS_BADGE_CLASSES entry — used to
 * render the status as plain colored text (a dot + label, no pill background).
 */
function statusTextClass(status: BidStatus): string {
  return STATUS_BADGE_CLASSES[status]
    .split(' ')
    .filter((c) => c.includes('text-'))
    .join(' ')
}

function getUrgencyStyle(dueDate: Date): React.CSSProperties {
  const days = differenceInCalendarDays(dueDate, startOfToday())
  if (days <= 3) return { background: 'rgba(239,68,68,0.15)', borderLeftColor: '#ef4444' }
  if (days <= 7) return { background: 'rgba(245,158,11,0.12)', borderLeftColor: '#f59e0b' }
  return {}
}

function getInitials(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** Synthetic month-view event standing in for the bids hidden by the 3-card cap. */
export interface OverflowEvent {
  id: string
  title: string
  start: Date
  end: Date
  isOverflow: true
  date: Date
  /** Every bid due that day — the popover lists all of them. */
  bids: Bid[]
}

export type CalendarDisplayEvent = CalendarEvent | OverflowEvent

interface CalendarEventProps {
  event: CalendarDisplayEvent
}

export default function CalendarEventComponent({ event }: CalendarEventProps) {
  if ('isOverflow' in event) {
    return <OverflowMore event={event} />
  }
  return <BidCard event={event} />
}

// ─── Status — plain colored text + dot (deliberately not a pill) ─────────────

function StatusIndicator({ status }: { status: BidStatus }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[10px] font-medium uppercase leading-none',
        statusTextClass(status),
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Scope chips — colored pills ─────────────────────────────────────────────

function scopesOf(bid: Bid) {
  return [...new Set((bid.line_items ?? []).map((li) => li.scope))]
}

function ScopeChips({ bid }: { bid: Bid }) {
  const uniqueScopes = scopesOf(bid)
  if (uniqueScopes.length === 0) return null
  return (
    <span
      style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 40, overflow: 'hidden' }}
    >
      {uniqueScopes.map((scope) => (
        <span key={scope} className={cn(CHIP_CLASS, SCOPE_BADGE_CLASSES[scope])}>
          {SCOPE_ABBREVIATIONS[scope] ?? scope}
        </span>
      ))}
    </span>
  )
}

// ─── Bid card ────────────────────────────────────────────────────────────────

function BidCard({ event }: { event: CalendarEvent }) {
  const { openBid } = useBidDetail()
  const { resource: bid } = event
  const isUnassigned = !bid.estimator_id
  const statusStyle = isUnassigned ? UNASSIGNED_COLORS : (STATUS_COLORS[bid.status] ?? STATUS_COLORS.Unassigned)
  const urgencyOverride = getUrgencyStyle(event.start)
  const initials = getInitials(bid.estimator_name)

  return (
    <button
      className={BRANCH_BADGE_CLASSES[bid.branch]}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '3px 6px',
        borderRadius: '5px',
        borderLeft: `3px solid ${urgencyOverride.borderLeftColor ?? statusStyle.border}`,
        cursor: 'pointer',
        display: 'block',
      }}
      onClick={(e) => {
        e.stopPropagation()
        openBid(bid)
      }}
    >
      <span
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '0.7rem',
          lineHeight: 1.3,
          color: statusStyle.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {initials ? `${initials} — ${bid.project_name}` : bid.project_name}
        {bid.project_location ? ` · ${bid.project_location}` : ''}
      </span>

      {/* Row 1 — status as plain colored text + dot */}
      <span style={{ display: 'block', marginTop: 2 }}>
        <StatusIndicator status={bid.status} />
      </span>

      {/* Row 2 — scope chips (colored pills) */}
      <span style={{ display: 'block', marginTop: 3 }}>
        <ScopeChips bid={bid} />
      </span>
    </button>
  )
}

// ─── "+N more" overflow popover ──────────────────────────────────────────────

function OverflowMore({ event }: { event: OverflowEvent }) {
  const { openBid } = useBidDetail()
  const [open, setOpen] = useState(false)
  const hiddenCount = event.bids.length - MONTH_VIEW_EVENT_CAP

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="block w-full cursor-pointer px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:underline"
          >
            + {hiddenCount} more
          </button>
        }
      />
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
          Bids due {format(event.date, 'EEE, MMM d')}
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {event.bids.map((bid) => (
            <button
              key={bid.id}
              type="button"
              onClick={() => {
                setOpen(false)
                openBid(bid)
              }}
              className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              <span className="truncate text-xs font-semibold text-foreground">
                {bid.project_name}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={cn(CHIP_CLASS, BRANCH_BADGE_CLASSES[bid.branch])}>
                  {bid.branch}
                </span>
                <StatusIndicator status={bid.status} />
                {scopesOf(bid).map((scope) => (
                  <span key={scope} className={cn(CHIP_CLASS, SCOPE_BADGE_CLASSES[scope])}>
                    {SCOPE_ABBREVIATIONS[scope] ?? scope}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
