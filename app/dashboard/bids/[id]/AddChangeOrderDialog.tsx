'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { BidChangeOrder, BidChangeOrderStatus } from '@/lib/supabase/types'
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
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const STATUS_OPTIONS: BidChangeOrderStatus[] = ['Pending', 'Approved', 'Rejected']

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
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<BidChangeOrderStatus>('Pending')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Initialize / reset form whenever the dialog opens
  useEffect(() => {
    if (!open) return

    if (existingCo) {
      setCoNumber(existingCo.co_number)
      setCoDate(existingCo.co_date ?? '')
      setDescription(existingCo.description ?? '')
      setValue(existingCo.value?.toString() ?? '')
      setStatus(existingCo.status)
      setNotes(existingCo.notes ?? '')
      return
    }

    // New CO: suggest CO-{next}, default to today
    setCoDate(todayIso())
    setDescription('')
    setValue('')
    setStatus('Pending')
    setNotes('')
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

  async function handleSave() {
    if (!coNumber.trim()) {
      toast.error('CO Number is required.')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      const parsedValue = value.trim() ? Number(value) : 0
      if (Number.isNaN(parsedValue)) {
        toast.error('Value must be a number.')
        setSaving(false)
        return
      }

      const row = {
        ...(existingCo?.id ? { id: existingCo.id } : {}),
        bid_id: bidId,
        co_number: coNumber.trim(),
        co_date: coDate || null,
        description: description.trim() || null,
        value: parsedValue,
        status,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('bid_change_orders')
        .upsert([row], { onConflict: 'id', defaultToNull: false })

      if (error) throw error

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-value">Value</Label>
              <Input
                id="co-value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00 (negative for credit)"
              />
            </div>
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
