'use client'

import { differenceInCalendarDays, startOfToday } from 'date-fns'
import { useBidDetail } from '@/contexts/bidDetail'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'
import type { BidStatus } from '@/hooks/useBids'

const STATUS_COLORS: Record<BidStatus, { bg: string; border: string; text: string }> = {
  Unassigned:    { bg: 'rgba(136,146,176,0.12)', border: '#8892b0', text: '#4a5270' },
  Bidding:       { bg: 'rgba(56,189,248,0.12)',  border: '#38bdf8', text: '#0ea5e9' },
  'In Progress': { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b', text: '#d97706' },
  Sent:          { bg: 'rgba(16,185,129,0.12)',  border: '#10b981', text: '#059669' },
  Awarded:       { bg: 'rgba(16,185,129,0.15)',  border: '#10b981', text: '#047857' },
  Lost:          { bg: 'rgba(239,68,68,0.1)',    border: '#ef4444', text: '#dc2626' },
}

// Unassigned overrides — rose/red color
const UNASSIGNED_COLORS = {
  bg: 'rgba(251,113,133,0.12)',
  border: '#fb7185',
  text: '#e11d48',
}

const SCOPE_COLORS: Record<string, string> = {
  'Plumbing Piping': '#0ea5e9',
  'HVAC Piping':     '#06b6d4',
  'HVAC Ductwork':   '#f97316',
  'Fire Stopping':   '#ef4444',
  'Equipment':       '#8b5cf6',
  'Other':           '#8892b0',
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

interface CalendarEventProps {
  event: CalendarEvent
}

export default function CalendarEventComponent({ event }: CalendarEventProps) {
  const { openBid } = useBidDetail()
  const { resource: bid } = event
  const isUnassigned = !bid.estimator_id
  const statusStyle = isUnassigned ? UNASSIGNED_COLORS : (STATUS_COLORS[bid.status] ?? STATUS_COLORS.Unassigned)
  const urgencyOverride = getUrgencyStyle(event.start)
  const uniqueScopes = [...new Set((bid.line_items ?? []).map((li) => li.scope))]
  const initials = getInitials(bid.estimator_name)

  return (
    <button
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '3px 6px',
        borderRadius: '5px',
        borderLeft: `3px solid ${urgencyOverride.borderLeftColor ?? statusStyle.border}`,
        background: urgencyOverride.background ?? statusStyle.bg,
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
      </span>

      {isUnassigned ? (
        <span style={{
          display: 'block',
          fontSize: '0.6rem',
          fontWeight: 600,
          color: UNASSIGNED_COLORS.text,
          marginTop: 1,
        }}>
          Unassigned
        </span>
      ) : (
        <span style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
          {uniqueScopes.slice(0, 1).map((scope) => (
            <span
              key={scope}
              style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: SCOPE_COLORS[scope] ?? 'var(--text3)',
              }}
            >
              {scope}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
