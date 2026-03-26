'use client'

import { Navigate, Views } from 'react-big-calendar'
import type { ToolbarProps, View } from 'react-big-calendar'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { CalendarEvent } from '@/lib/calendar/transformBidsToEvents'

export default function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
}: ToolbarProps<CalendarEvent, object>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          aria-label="Previous"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text2)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--accent2)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
          }}
        >
          <ChevronLeftIcon size={14} />
        </button>

        <button
          onClick={() => onNavigate(Navigate.TODAY)}
          style={{
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text2)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--accent2)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
          }}
        >
          Today
        </button>

        <button
          onClick={() => onNavigate(Navigate.NEXT)}
          aria-label="Next"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text2)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--accent2)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
          }}
        >
          <ChevronRightIcon size={14} />
        </button>
      </div>

      {/* Current period label */}
      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', letterSpacing: '-0.3px' }}>
        {label}
      </span>

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {([Views.MONTH, Views.WEEK] as View[]).map((v) => {
          const isActive = view === v
          return (
            <button
              key={v}
              onClick={() => onView(v)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                background: isActive ? 'linear-gradient(135deg, #38bdf8, #0ea5e9)' : 'var(--surface)',
                color: isActive ? 'white' : 'var(--text2)',
                border: isActive ? 'none' : '1px solid var(--border)',
                boxShadow: isActive ? '0 4px 14px rgba(56,189,248,0.35)' : 'none',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
