'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import type { BidScope } from '@/lib/supabase/types'

const priceFormSchema = z.object({
  price: z.string().refine(
    (v) => {
      const t = v.trim()
      if (t === '') return true
      const n = Number(t)
      return Number.isFinite(n) && n >= 0
    },
    { message: 'Enter a non-negative number' },
  ),
})

type PriceForm = z.infer<typeof priceFormSchema>

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

interface InlinePriceCellProps {
  lineItemId: string
  bidId: string
  userId: string | null
  scope: BidScope
  initialPrice: number | null
  className?: string
}

export function InlinePriceCell({
  lineItemId,
  bidId,
  userId,
  scope,
  initialPrice,
  className,
}: InlinePriceCellProps) {
  const [editing, setEditing] = useState(false)
  const [optimistic, setOptimistic] = useState<number | null>(initialPrice)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const submittedRef = useRef(false)

  // Reconcile optimistic value with server data when not editing
  useEffect(() => {
    if (!editing) setOptimistic(initialPrice)
  }, [initialPrice, editing])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceForm>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: { price: initialPrice?.toString() ?? '' },
  })

  function startEdit() {
    if (saving) return
    reset({ price: optimistic?.toString() ?? '' })
    submittedRef.current = false
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  async function save(values: PriceForm) {
    if (submittedRef.current) return
    submittedRef.current = true

    const trimmed = values.price.trim()
    const newPrice = trimmed === '' ? null : Math.round(Number(trimmed))

    if (newPrice === optimistic) {
      setEditing(false)
      return
    }

    const prevPrice = optimistic
    setOptimistic(newPrice)
    setEditing(false)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('bid_line_items')
      .update({ price: newPrice })
      .eq('id', lineItemId)

    if (error) {
      setOptimistic(prevPrice)
      setSaving(false)
      toast.error('Failed to update scope price.')
      return
    }

    if (userId) {
      const fmt = (v: number | null) => (v == null ? '—' : formatCurrency(v))
      await logActivity(
        bidId,
        userId,
        `Updated ${scope} price from ${fmt(prevPrice)} to ${fmt(newPrice)}`,
      )
    }

    setSaving(false)
    toast.success('Scope price updated.')
  }

  if (editing) {
    const priceField = register('price')
    return (
      <form
        onSubmit={handleSubmit(save)}
        onClick={(e) => e.stopPropagation()}
        className="flex justify-end"
      >
        <input
          {...priceField}
          ref={(el) => {
            priceField.ref(el)
            inputRef.current = el
          }}
          type="number"
          step="1"
          min="0"
          inputMode="numeric"
          autoFocus
          disabled={saving}
          aria-label={`${scope} price`}
          aria-invalid={!!errors.price}
          onBlur={() => {
            // Submit on blur unless already submitted via Enter
            handleSubmit(save)()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              submittedRef.current = true
              setEditing(false)
            }
          }}
          className={
            'h-7 w-28 rounded-md border border-[var(--accent)] bg-background px-2 text-right text-sm font-semibold tabular-nums shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          }
          style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
        />
      </form>
    )
  }

  const display =
    optimistic != null && optimistic > 0 ? formatCurrency(optimistic) : '—'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
      disabled={saving}
      title="Click to edit price"
      aria-label={`Edit ${scope} price`}
      className={
        className ??
        'w-full text-right text-sm font-semibold tabular-nums rounded px-1 py-0.5 hover:bg-muted/60 transition-colors cursor-text'
      }
      style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
    >
      {saving ? <span className="opacity-60">{display}</span> : display}
    </button>
  )
}
