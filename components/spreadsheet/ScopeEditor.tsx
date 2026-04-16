'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Bid, BidScope } from '@/lib/supabase/types'
import { SCOPE_BADGE_CLASSES } from '@/config/colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
} from '@/components/ui/popover'

const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export interface DraftItem {
  id?: string
  scope: BidScope | ''
  price: string
  isNew?: boolean
}

interface ScopeEditorProps {
  bid?: Bid
  /** Draft mode: parent owns state, popover never touches supabase. */
  draftMode?: boolean
  draftItems?: DraftItem[]
  onDraftSave?: (items: DraftItem[]) => void
  placeholder?: React.ReactNode
  triggerClassName?: string
}

type ScopeState = Record<BidScope, { checked: boolean; price: string; id?: string }>

function emptyState(): ScopeState {
  return ALL_SCOPES.reduce((acc, s) => {
    acc[s] = { checked: false, price: '' }
    return acc
  }, {} as ScopeState)
}

export function ScopeEditor({
  bid,
  draftMode = false,
  draftItems,
  onDraftSave,
  placeholder,
  triggerClassName,
}: ScopeEditorProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ScopeState>(emptyState)
  const [saving, setSaving] = useState(false)

  // When popover opens, initialize state from props
  useEffect(() => {
    if (!open) return
    const next = emptyState()
    const source: DraftItem[] = draftMode
      ? (draftItems ?? []).map((i) => ({ ...i }))
      : (bid?.line_items ?? []).map((li) => ({
          id: li.id,
          scope: li.scope,
          price: li.price?.toString() ?? '',
        }))
    for (const item of source) {
      if (item.scope && next[item.scope as BidScope]) {
        next[item.scope as BidScope] = {
          checked: true,
          price: item.price ?? '',
          id: item.id,
        }
      }
    }
    setState(next)
  }, [open, bid?.line_items, draftMode, draftItems])

  // Display scopes: in draft mode read from draftItems, else from bid
  const displayScopes = draftMode
    ? [...new Set((draftItems ?? []).filter((i) => i.scope !== '').map((i) => i.scope as BidScope))]
    : [...new Set((bid?.line_items ?? []).map((li) => li.scope))]

  const triggerContent =
    displayScopes.length === 0 ? (
      placeholder ?? <span className="italic text-muted-foreground text-xs">&mdash;</span>
    ) : (
      <div className="flex flex-wrap gap-1">
        {displayScopes.map((scope) => (
          <Badge key={scope} className={SCOPE_BADGE_CLASSES[scope]} variant="outline">
            {scope}
          </Badge>
        ))}
      </div>
    )

  const total = ALL_SCOPES.reduce((sum, s) => {
    if (!state[s].checked) return sum
    const p = parseFloat(state[s].price)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  function toggleScope(scope: BidScope, checked: boolean) {
    setState((prev) => ({
      ...prev,
      [scope]: {
        ...prev[scope],
        checked,
        // Clear price when unchecking
        price: checked ? prev[scope].price : '',
      },
    }))
  }

  function updatePrice(scope: BidScope, price: string) {
    setState((prev) => ({
      ...prev,
      [scope]: { ...prev[scope], price },
    }))
  }

  function collectItems(): DraftItem[] {
    return ALL_SCOPES.filter((s) => state[s].checked).map((s) => ({
      id: state[s].id,
      scope: s,
      price: state[s].price,
    }))
  }

  async function handleSave() {
    const items = collectItems()

    // Draft mode: hand state back to parent, do not touch supabase
    if (draftMode) {
      onDraftSave?.(items)
      setOpen(false)
      return
    }

    if (!bid) return
    setSaving(true)
    const supabase = createClient()

    try {
      const existingIds = new Set((bid.line_items ?? []).map((li) => li.id))
      const draftIds = new Set(items.map((i) => i.id).filter(Boolean) as string[])

      // Delete removed items
      const deletedIds = [...existingIds].filter((id) => !draftIds.has(id))
      if (deletedIds.length > 0) {
        await supabase.from('bid_line_items').delete().in('id', deletedIds)
      }

      // Upsert selected items
      const upsertRows = items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        bid_id: bid.id,
        scope: item.scope as BidScope,
        price: item.price.trim() ? parseFloat(item.price) : null,
        client: null as string | null,
      }))

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('bid_line_items')
          .upsert(upsertRows, { onConflict: 'id' })
        if (error) throw error
      }

      toast.success('Scope pricing saved.')
      setOpen(false)
    } catch {
      toast.error('Failed to save scope pricing.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className={triggerClassName ?? 'w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors'}
            title="Click to edit scope pricing"
          />
        }
      >
        {triggerContent}
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" side="bottom" align="start">
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
            Scope Pricing
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 2 }}>
            Check scopes to include, then enter a price.
          </p>
        </div>

        {/* Scope checklist */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALL_SCOPES.map((scope) => {
            const row = state[scope]
            return (
              <label
                key={scope}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => toggleScope(scope, e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Badge
                    className={SCOPE_BADGE_CLASSES[scope]}
                    variant="outline"
                    style={{ fontSize: '0.7rem' }}
                  >
                    {scope}
                  </Badge>
                </div>
                {row.checked && (
                  <Input
                    type="number"
                    value={row.price}
                    placeholder="$0"
                    min="0"
                    step="1"
                    onChange={(e) => updatePrice(scope, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: 96,
                      height: 28,
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                    }}
                    className="h-7 text-xs"
                  />
                )}
              </label>
            )
          })}
        </div>

        {/* Running total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)' }}>Total</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: '"IBM Plex Mono", monospace', color: 'var(--text)' }}>
            {total > 0 ? formatCurrency(total) : '\u2014'}
          </span>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <PopoverClose
            render={
              <Button variant="outline" size="sm" style={{ height: 28, fontSize: '0.72rem' }} />
            }
          >
            Cancel
          </PopoverClose>
          <Button
            size="sm"
            style={{ height: 28, fontSize: '0.72rem' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving\u2026' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
