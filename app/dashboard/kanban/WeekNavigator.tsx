'use client'

import { useState } from 'react'
import { format, subDays, addDays, startOfWeek, isValid } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseYmd(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isValid(d) ? d : null
}

function isSameWeek(date1: Date, date2: Date): boolean {
  const s1 = startOfWeek(date1, { weekStartsOn: 1 })
  const s2 = startOfWeek(date2, { weekStartsOn: 1 })
  return s1.getTime() === s2.getTime()
}

function formatWeekRange(start: Date, end: Date): string {
  const fmt = 'MMM d, yyyy'
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, fmt)}`
  }
  return `${format(start, fmt)} – ${format(end, fmt)}`
}

/**
 * Week navigator — prev/next arrows, a label with a jump-to-week date picker,
 * and a "This week" badge. Duplicates the pattern from the Recaps Weekly tab.
 *
 * `value` is the Monday that starts the selected week; `onChange` always
 * receives a Monday (start of the chosen week).
 */
export function WeekNavigator({
  value,
  onChange,
}: {
  value: Date
  onChange: (week: Date) => void
}) {
  const [showPicker, setShowPicker] = useState(false)

  const weekStart = value
  const weekEnd = addDays(value, 6)
  const isCurrentWeek = isSameWeek(value, new Date())

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => onChange(subDays(value, 7))}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.borderColor = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        aria-label="Previous week"
      >
        <ChevronLeft size={16} />
      </button>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowPicker((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)'
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <CalendarIcon size={14} />
          <span>{formatWeekRange(weekStart, weekEnd)}</span>
          {isCurrentWeek && (
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#d97706',
                background: 'rgba(217, 119, 6, 0.12)',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              This week
            </span>
          )}
        </button>

        {showPicker && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setShowPicker(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                zIndex: 50,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <input
                type="date"
                value={toYmd(weekStart)}
                onChange={(e) => {
                  const parsed = parseYmd(e.target.value)
                  if (parsed) {
                    onChange(startOfWeek(parsed, { weekStartsOn: 1 }))
                    setShowPicker(false)
                  }
                }}
                style={{
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                }}
                autoFocus
              />
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => onChange(addDays(value, 7))}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.borderColor = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        aria-label="Next week"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
