'use client'

import { useState, useRef } from 'react'
import { CalendarIcon } from 'lucide-react'

/**
 * SmartDateInput — accepts natural date entry like:
 *   3/26, 3/26/26, 3/26/2026, 03-26-2026
 * On blur formats to MM/DD/YYYY internally and stores as YYYY-MM-DD for forms.
 * Shows red border if invalid.
 */

interface SmartDateInputProps {
  /** Current value in YYYY-MM-DD format (HTML date format) */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
}

const CURRENT_YEAR = new Date().getFullYear()

function parseSmartDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null

  // Try native date parse for YYYY-MM-DD (already in ISO format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00')
    if (!isNaN(d.getTime())) return d
  }

  // Normalize separators
  const normalized = s.replace(/[-./\\]/g, '/')

  // Split on /
  const parts = normalized.split('/')

  if (parts.length < 2) return null

  let month: number, day: number, year: number

  month = parseInt(parts[0], 10)
  day = parseInt(parts[1], 10)

  if (parts.length >= 3) {
    const rawYear = parseInt(parts[2], 10)
    if (rawYear < 100) {
      year = 2000 + rawYear
    } else {
      year = rawYear
    }
  } else {
    year = CURRENT_YEAR
  }

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime())) return null
  // Ensure the date wasn't rolled (e.g. Feb 30)
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null

  return d
}

function toDisplayFormat(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const y = date.getFullYear()
  return `${m}/${d}/${y}`
}

function toISODate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const y = date.getFullYear()
  return `${y}-${m}-${d}`
}

function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return toDisplayFormat(d)
}

export function SmartDateInput({
  value,
  onChange,
  id,
  placeholder = 'MM/DD/YYYY',
  className = '',
}: SmartDateInputProps) {
  const [raw, setRaw] = useState<string>('')
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)

  const displayValue = focused ? raw : isoToDisplay(value)

  function handleFocus() {
    setFocused(true)
    setRaw(isoToDisplay(value))
    setInvalid(false)
  }

  function handleBlur() {
    setFocused(false)
    if (!raw.trim()) {
      setInvalid(false)
      onChange('')
      return
    }
    const parsed = parseSmartDate(raw)
    if (parsed) {
      setInvalid(false)
      onChange(toISODate(parsed))
    } else {
      setInvalid(true)
    }
  }

  function handleCalendarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value
    onChange(iso)
    setRaw(isoToDisplay(iso))
    setInvalid(false)
  }

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setRaw(e.target.value)}
        className={className}
        style={{
          paddingRight: '2.25rem',
          borderColor: invalid ? 'var(--red)' : undefined,
          boxShadow: invalid ? '0 0 0 3px var(--red-light)' : undefined,
        }}
      />
      {/* Calendar picker overlay */}
      <label
        htmlFor={id ? `${id}-picker` : undefined}
        style={{
          position: 'absolute',
          right: '0.5rem',
          cursor: 'pointer',
          color: 'var(--text3)',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Pick a date"
      >
        <CalendarIcon size={15} />
      </label>
      <input
        ref={hiddenRef}
        id={id ? `${id}-picker` : undefined}
        type="date"
        value={value}
        onChange={handleCalendarChange}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '2rem',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
