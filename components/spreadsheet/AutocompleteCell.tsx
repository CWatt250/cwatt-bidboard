'use client'

import { useEffect, useRef, useState } from 'react'

export interface AutocompleteCellProps {
  options: string[]
  selected: string[]
  onSelect: (value: string) => void
  onRemove?: (value: string) => void
  placeholder?: string
  allowAdd?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
  renderSelected?: (selected: string[]) => React.ReactNode
}

export function AutocompleteCell({
  options,
  selected,
  onSelect,
  onRemove,
  placeholder = 'Type to search...',
  allowAdd = false,
  onKeyDown,
  renderSelected,
}: AutocompleteCellProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const trimmed = query.trim().toLowerCase()

  const filtered = options.filter(
    (o) => !selected.includes(o) && (trimmed === '' || o.toLowerCase().includes(trimmed))
  )

  const exactMatch = options.some((o) => o.toLowerCase() === trimmed)
  const alreadySelected = selected.some((s) => s.toLowerCase() === trimmed)
  const showAdd = allowAdd && trimmed !== '' && !exactMatch && !alreadySelected

  const totalItems = filtered.length + (showAdd ? 1 : 0)

  useEffect(() => {
    setHighlightIndex(0)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectItem(value: string) {
    onSelect(value)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open && totalItems > 0) {
        setOpen(true)
        return
      }
      setHighlightIndex((i) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && totalItems > 0) {
      e.preventDefault()
      e.stopPropagation()
      if (highlightIndex < filtered.length) {
        selectItem(filtered[highlightIndex])
      } else if (showAdd) {
        selectItem(query.trim())
      }
    } else if (e.key === 'Backspace' && query === '' && selected.length > 0 && onRemove) {
      e.preventDefault()
      onRemove(selected[selected.length - 1])
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery('')
        return
      }
      // Let parent handle Escape when dropdown is closed
      onKeyDown?.(e)
    } else if (e.key === 'Enter' && !open) {
      // Dropdown not open — pass through to parent (commit row)
      onKeyDown?.(e)
    } else if (e.key === 'Tab') {
      setOpen(false)
      setQuery('')
    }
  }

  const showDropdown = open && totalItems > 0

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {!focused && selected.length > 0 && renderSelected ? (
        <div
          onClick={() => {
            setFocused(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          style={{
            cursor: 'text',
            fontSize: '0.8rem',
            minHeight: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {renderSelected(selected)}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {focused && selected.map((s) => (
            <span
              key={s}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--accent, #f0f0f0)',
                fontSize: '0.7rem',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}
            >
              {s}
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(s)
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.7rem',
                    color: 'var(--text3)',
                    lineHeight: 1,
                  }}
                  aria-label={`Remove ${s}`}
                >
                  x
                </button>
              )}
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={selected.length > 0 ? '' : placeholder}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setFocused(true)
              setOpen(true)
            }}
            onBlur={() => {
              // Delay to allow click on dropdown items
              setTimeout(() => {
                setFocused(false)
                setOpen(false)
                setQuery('')
              }, 150)
            }}
            onKeyDown={handleInputKeyDown}
            className="ghost-cell-input"
            style={{
              flex: 1,
              minWidth: 60,
              width: '100%',
              padding: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            minWidth: 180,
            maxHeight: 200,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 50,
            marginTop: 2,
          }}
        >
          {filtered.map((option, i) => (
            <div
              key={option}
              onMouseDown={(e) => {
                e.preventDefault()
                selectItem(option)
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: i === highlightIndex ? 'var(--accent, #f0f4ff)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              {option}
            </div>
          ))}
          {showAdd && (
            <div
              onMouseDown={(e) => {
                e.preventDefault()
                selectItem(query.trim())
              }}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: highlightIndex === filtered.length ? 'var(--accent, #f0f4ff)' : 'transparent',
                color: '#378ADD',
                borderTop: filtered.length > 0 ? '1px solid var(--border)' : undefined,
              }}
            >
              + Add &ldquo;{query.trim()}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
