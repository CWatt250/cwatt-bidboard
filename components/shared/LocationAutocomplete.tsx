'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { MapPinIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

// Runtime check: make a missing token noticeable in the browser console
// without breaking the build or the form — the field degrades to plain text.
if (!MAPBOX_TOKEN && typeof window !== 'undefined') {
  console.warn(
    '[BidWatt] NEXT_PUBLIC_MAPBOX_TOKEN is not set — Project Location address ' +
      'autocomplete is disabled; the field falls back to a plain text input.',
  )
}

interface LocationAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Project Location field with Mapbox address autocomplete.
 *
 * Typing fires a debounced Mapbox Geocoding lookup and shows up to 5 US
 * suggestions; picking one stores its formatted `place_name`. Freeform text is
 * kept as-is when no suggestion is chosen. When NEXT_PUBLIC_MAPBOX_TOKEN is
 * absent the component is just a plain text input, so the build and runtime
 * stay safe before the token is provisioned.
 */
export function LocationAutocomplete(props: LocationAutocompleteProps) {
  if (!MAPBOX_TOKEN) {
    return (
      <Input
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    )
  }
  return <MapboxLocationField token={MAPBOX_TOKEN} {...props} />
}

interface Suggestion {
  id: string
  placeName: string
}

function MapboxLocationField({
  token,
  id,
  value,
  onChange,
  placeholder,
}: LocationAutocompleteProps & { token: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // The `value` change a suggestion pick produces must not re-trigger a
  // lookup, or the menu would immediately reopen on top of the selection.
  const skipNextLookup = useRef(false)
  const listboxId = useId()

  // Debounced (300ms) Mapbox Geocoding lookup, US-only, capped at 5 results.
  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false
      return
    }
    const query = value.trim()
    const controller = new AbortController()
    const timer = setTimeout(() => {
      if (query.length < MIN_QUERY_LENGTH) {
        setSuggestions([])
        setOpen(false)
        return
      }
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${token}&country=us&limit=5&types=place,locality,address&autocomplete=true`
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Mapbox geocoding failed (${res.status})`)
          return res.json() as Promise<{
            features?: { id: string; place_name: string }[]
          }>
        })
        .then((data) => {
          const next = (data.features ?? []).map((f) => ({
            id: f.id,
            placeName: f.place_name,
          }))
          setSuggestions(next)
          setActiveIndex(-1)
          setOpen(next.length > 0)
        })
        .catch((err: unknown) => {
          // Aborts are expected on every keystroke; any other failure just
          // means no suggestions — freeform text can still be submitted.
          if ((err as { name?: string })?.name === 'AbortError') return
          setSuggestions([])
          setOpen(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, token])

  // Close the menu when clicking outside (mirrors ScopePicker in this dialog).
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function pick(placeName: string) {
    skipNextLookup.current = true
    onChange(placeName)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pick(suggestions[activeIndex].placeName)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                // mousedown + preventDefault so the pick wins the race
                // against the input losing focus.
                e.preventDefault()
                pick(s.placeName)
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                i === activeIndex && 'bg-muted',
              )}
            >
              <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.placeName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
