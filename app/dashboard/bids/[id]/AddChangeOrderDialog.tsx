'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BidChangeOrder, BidChangeOrderItem, BidChangeOrderStatus, BidScope } from '@/lib/supabase/types'
import { SCOPE_ABBREVIATIONS, SCOPE_BADGE_CLASSES } from '@/config/colors'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface AddChangeOrderDialogProps {
  bidId: string
  bidProjectName: string
  existingCo?: BidChangeOrder
  bidLineItemScopes?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const STATUS_OPTIONS: BidChangeOrderStatus[] = ['Pending', 'Approved', 'Rejected']

const SCOPE_PILL_CLASS =
  'inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none min-w-[42px]'

/** Canonical scope list shown in the dropdown — order matches the design spec. */
const SCOPE_OPTIONS: readonly BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Refer Piping',
  'Equipment',
  'Other',
]

function ScopeOption({ scope }: { scope: string }) {
  if (scope === 'General') {
    return <span className="text-muted-foreground">General</span>
  }
  const badge = SCOPE_BADGE_CLASSES[scope as BidScope]
  const abbrev = SCOPE_ABBREVIATIONS[scope as BidScope]
  if (!badge || !abbrev) {
    return <span>{scope}</span>
  }
  return (
    <span className="flex items-center gap-2">
      <span className={cn(SCOPE_PILL_CLASS, badge)}>{abbrev}</span>
      <span>{scope}</span>
    </span>
  )
}

interface ScopeRow {
  /** Temporary client-side id for React keys. Null during edit means a row that exists in DB (will be deleted and re-inserted). */
  _key: string
  scope: string
  value: string
}

let nextKey = 1
function newRowKey(): string {
  return `row_${nextKey++}`
}

function defaultRows(): ScopeRow[] {
  return [{ _key: newRowKey(), scope: 'General', value: '' }]
}

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Best-effort: pull the trailing integer from a CO number like "CO-7" → 7. */
function parseCoSeq(co: string): number | null {
  const m = co.match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

export function AddChangeOrderDialog({
  bidId,
  bidProjectName,
  existingCo,
  open,
  onOpenChange,
  onSaved,
}: AddChangeOrderDialogProps) {
  const isEdit = Boolean(existingCo)

  const [coNumber, setCoNumber] = useState('')
  const [coDate, setCoDate] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<BidChangeOrderStatus>('Pending')
  const [notes, setNotes] = useState('')
  const [scopeRows, setScopeRows] = useState<ScopeRow[]>(defaultRows())
  const [saving, setSaving] = useState(false)

  // Initialize / reset form whenever the dialog opens
  useEffect(() => {
    if (!open) return

    if (existingCo) {
      setCoNumber(existingCo.co_number)
      setCoDate(existingCo.co_date ?? '')
      setDescription(existingCo.description ?? '')
      setStatus(existingCo.status)
      setNotes(existingCo.notes ?? '')

      // Load existing items, or one default row
      const items = existingCo.items
      if (items && items.length > 0) {
        setScopeRows(
          items.map((item) => ({
            _key: item.id,
            scope: item.scope,
            value: item.value?.toString() ?? '',
          }))
        )
      } else {
        setScopeRows(defaultRows())
      }
      return
    }

    // New CO
    setCoDate(todayIso())
    setDescription('')
    setStatus('Pending')
    setNotes('')
    setScopeRows(defaultRows())
    setCoNumber('') // will be filled by the async query below

    const supabase = createClient()
    void supabase
      .from('bid_change_orders')
      .select('co_number')
      .eq('bid_id', bidId)
      .then(({ data }) => {
        const seqs = (data ?? [])
          .map((r) => parseCoSeq(r.co_number as string))
          .filter((n): n is number => n !== null)
        const next = seqs.length > 0 ? Math.max(...seqs) + 1 : 1
        setCoNumber(`CO-${next}`)
      })
  }, [open, existingCo, bidId])

  function updateScopeRow(key: string, field: 'scope' | 'value', val: string | null) {
    setScopeRows((rows) =>
      rows.map((r) => (r._key === key ? { ...r, [field]: val ?? '' } : r))
    )
  }

  function removeScopeRow(key: string) {
    setScopeRows((rows) => rows.filter((r) => r._key !== key))
  }

  function addScopeRow() {
    setScopeRows((rows) => [
      ...rows,
      { _key: newRowKey(), scope: 'General', value: '' },
    ])
  }

  const total = scopeRows.reduce((sum, r) => {
    const v = r.value.trim() ? Number(r.value) : 0
    return sum + (Number.isNaN(v) ? 0 : v)
  }, 0)

  async function handleSave() {
    if (!coNumber.trim()) {
      toast.error('CO Number is required.')
      return
    }

    // Validate all scope values
    for (const row of scopeRows) {
      if (row.value.trim() && Number.isNaN(Number(row.value))) {
        toast.error(`Invalid value for scope "${row.scope}".`)
        return
      }
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Upsert the parent change order row (no more scope/value columns)
      const { data: savedCo, error: coError } = await supabase
        .from('bid_change_orders')
        .upsert(
          {
            ...(existingCo?.id ? { id: existingCo.id } : {}),
            bid_id: bidId,
            co_number: coNumber.trim(),
            co_date: coDate || null,
            description: description.trim() || null,
            status,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('id')
        .single()

      if (coError) throw coError
      if (!savedCo) throw new Error('No CO returned after upsert')

      const coId = savedCo.id

      // Delete all existing items for this CO (cascade-safe via ON DELETE CASCADE,
      // but we do it explicitly to replace)
      await supabase
        .from('bid_change_order_items')
        .delete()
        .eq('change_order_id', coId)

      // Insert fresh items — skip rows with empty scope (shouldn't happen) but allow 0/negative values
      const itemsToInsert: Partial<BidChangeOrderItem>[] = scopeRows
        .filter((row) => row.scope.trim() !== '')
        .map((row) => ({
          change_order_id: coId,
          scope: row.scope,
          value: row.value.trim() ? Number(row.value) : 0,
        }))

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('bid_change_order_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      toast.success(isEdit ? 'Change order updated.' : 'Change order added.')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error('[AddChangeOrderDialog] save failed', err)
      const msg = err instanceof Error ? err.message : 'Failed to save change order.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Change Order' : 'Add Change Order'}
            <span className="ml-2 text-muted-foreground font-normal">· {bidProjectName}</span>
          </DialogTitle>
        </DialogHeader>

        <form
          id="bid-co-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-number">CO Number</Label>
              <Input
                id="co-number"
                value={coNumber}
                onChange={(e) => setCoNumber(e.target.value)}
                placeholder="CO-1"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-date">Date</Label>
              <Input
                id="co-date"
                type="date"
                value={coDate}
                onChange={(e) => setCoDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-description">Description</Label>
            <Textarea
              id="co-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope of the change"
              rows={3}
            />
          </div>

          {/* Scope Breakdown */}
          <div className="space-y-2">
            <Label>Scope Breakdown</Label>
            <div className="space-y-2">
              {scopeRows.map((row, idx) => (
                <div key={row._key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      value={row.scope}
                      onValueChange={(v) => updateScopeRow(row._key, 'scope', v)}
                    >
                      <SelectTrigger>
                        <ScopeOption scope={row.scope} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">
                          <ScopeOption scope="General" />
                        </SelectItem>
                        {SCOPE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            <ScopeOption scope={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[140px]">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.value}
                      onChange={(e) => updateScopeRow(row._key, 'value', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeScopeRow(row._key)}
                    disabled={scopeRows.length <= 1}
                    className="mt-0.5 shrink-0"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addScopeRow}
              className="mt-1"
            >
              <PlusIcon className="size-3.5 mr-1" />
              Add Scope
            </Button>

            <p
              className="text-sm font-semibold tabular-nums text-right"
              style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
            >
              Total: {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(total)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as BidChangeOrderStatus)}
              >
                <SelectTrigger id="co-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-notes">Notes</Label>
            <Textarea
              id="co-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button form="bid-co-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
