'use client'

import { useEffect, useRef, useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Bid, BidLineItem, BidScope } from '@/lib/supabase/types'
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

interface DraftItem {
  id?: string
  scope: BidScope | ''
  price: string
  isNew?: boolean
}

interface ScopePricingPopoverProps {
  bid: Bid
}

export function ScopePricingPopover({ bid }: ScopePricingPopoverProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DraftItem[]>([])
  const [saving, setSaving] = useState(false)

  // When popover opens, initialize draft from bid.line_items
  useEffect(() => {
    if (open) {
      const drafts: DraftItem[] = (bid.line_items ?? []).map((li) => ({
        id: li.id,
        scope: li.scope,
        price: li.price?.toString() ?? '',
      }))
      setItems(drafts)
    }
  }, [open, bid.line_items])

  const scopes = [...new Set((bid.line_items ?? []).map((li) => li.scope))]

  // Display trigger content
  const triggerContent =
    scopes.length === 0 ? (
      <span className="italic text-muted-foreground text-xs">—</span>
    ) : (
      <div className="flex flex-wrap gap-1">
        {scopes.map((scope) => (
          <Badge key={scope} className={SCOPE_BADGE_CLASSES[scope]} variant="outline">
            {scope}
          </Badge>
        ))}
      </div>
    )

  const total = items.reduce((sum, item) => {
    const p = parseFloat(item.price)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  function addScope() {
    setItems((prev) => [...prev, { scope: '', price: '', isNew: true }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      const existingIds = new Set((bid.line_items ?? []).map((li) => li.id))
      const draftIds = new Set(items.map((i) => i.id).filter(Boolean))

      // Delete removed items
      const deletedIds = [...existingIds].filter((id) => !draftIds.has(id))
      if (deletedIds.length > 0) {
        await supabase.from('bid_line_items').delete().in('id', deletedIds)
      }

      // Upsert all items (new and existing)
      const upsertRows = items
        .filter((item) => item.scope !== '')
        .map((item) => ({
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
            className="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
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
        </div>

        {/* Scope rows */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text3)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
              No scopes yet. Add one below.
            </p>
          )}
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Scope selector */}
              {item.isNew || item.scope === '' ? (
                <select
                  value={item.scope}
                  onChange={(e) => {
                    const val = e.target.value as BidScope
                    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, scope: val } : it))
                  }}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    outline: 'none',
                    minWidth: 0,
                  }}
                >
                  <option value="">Select scope…</option>
                  {ALL_SCOPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Badge
                    className={SCOPE_BADGE_CLASSES[item.scope as BidScope]}
                    variant="outline"
                    style={{ fontSize: '0.7rem' }}
                  >
                    {item.scope}
                  </Badge>
                </div>
              )}

              {/* Price input */}
              <Input
                type="number"
                value={item.price}
                placeholder="Price"
                min="0"
                step="1"
                onChange={(e) => {
                  const val = e.target.value
                  setItems((prev) => prev.map((it, i) => i === idx ? { ...it, price: val } : it))
                }}
                style={{ width: 90, height: 28, fontSize: '0.75rem', padding: '2px 6px' }}
                className="h-7 text-xs"
              />

              {/* Delete */}
              <button
                onClick={() => removeItem(idx)}
                title="Remove"
                style={{ color: 'var(--text3)', flexShrink: 0, padding: 2 }}
                className="hover:text-destructive transition-colors"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Running total */}
        {items.length > 0 && (
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
              {total > 0 ? formatCurrency(total) : '—'}
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={addScope}
            style={{
              flex: 1,
              fontSize: '0.75rem',
              color: 'var(--accent)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            <PlusIcon className="size-3" />
            Add Scope
          </button>
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
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
