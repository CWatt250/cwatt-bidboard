'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { useUserRole } from '@/contexts/userRole'
import { useBidDetail } from '@/contexts/bidDetail'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SmartDateInput } from '@/components/ui/SmartDateInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SCOPES = ['Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other'] as const
const BRANCHES = ['PSC', 'SEA', 'POR', 'PHX', 'SLC'] as const

const BRANCH_LABELS: Record<string, string> = {
  PSC: 'Pasco, WA',
  SEA: 'Seattle, WA',
  POR: 'Portland, OR',
  PHX: 'Phoenix, AZ',
  SLC: 'Salt Lake City, UT',
}

// ─── Multi-Scope Checkbox Dropdown ───────────────────────────────────────────

interface ScopePickerProps {
  selected: string[]
  onChange: (scopes: string[]) => void
  error?: boolean
}

function ScopePicker({ selected, onChange, error }: ScopePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggle(scope: string) {
    if (selected.includes(scope)) {
      onChange(selected.filter((s) => s !== scope))
    } else {
      onChange([...selected, scope])
    }
  }

  const label = selected.length === 0
    ? 'Select scopes…'
    : selected.join(', ')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          height: 32,
          padding: '0 8px',
          borderRadius: 8,
          border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          background: 'var(--surface)',
          color: selected.length === 0 ? 'var(--text3)' : 'var(--text)',
          fontSize: '0.875rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          boxShadow: error ? '0 0 0 3px var(--red-light)' : undefined,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
          {label}
        </span>
        <ChevronDownIcon size={13} style={{ flexShrink: 0, color: 'var(--text3)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow)',
          zIndex: 50,
          padding: '4px 0',
        }}>
          {SCOPES.map((scope) => (
            <label
              key={scope}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text)',
                background: selected.includes(scope) ? 'var(--accent-light)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!selected.includes(scope)) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = selected.includes(scope) ? 'var(--accent-light)' : 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(scope)}
                onChange={() => toggle(scope)}
                style={{ accentColor: 'var(--accent2)', width: 14, height: 14, flexShrink: 0 }}
              />
              {scope}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const scopePriceSchema = z.object({
  scope: z.string().min(1),
  price: z.string().optional(),
})

const lineItemSchema = z.object({
  client: z.string().min(1, 'Client is required'),
  scope_prices: z.array(scopePriceSchema).min(1, 'At least one scope required'),
})

const newBidSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  branch: z.enum(BRANCHES, { error: 'Branch is required' }),
  estimator_id: z.string().nullable().optional(),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type NewBidForm = z.infer<typeof newBidSchema>

// ─── NewBidDialog ─────────────────────────────────────────────────────────────

interface NewBidDialogProps {
  defaultProjectName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function NewBidDialog({ defaultProjectName, open: externalOpen, onOpenChange: externalOnOpenChange }: NewBidDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen
  const [submitting, setSubmitting] = useState(false)
  const [createAsUnassigned, setCreateAsUnassigned] = useState(false)

  const { profile } = useUserRole()
  const { profiles } = useBidDetail()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewBidForm>({
    resolver: zodResolver(newBidSchema),
    defaultValues: {
      project_name: defaultProjectName ?? '',
      branch: '' as any,
      estimator_id: profile?.id ?? null,
      bid_due_date: '',
      notes: '',
      line_items: [{ client: '', scope_prices: [] }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  // Reset form with new defaultProjectName whenever the dialog opens
  useEffect(() => {
    if (!open) return
    setCreateAsUnassigned(false)
    reset({
      project_name: defaultProjectName ?? '',
      branch: '' as any,
      estimator_id: profile?.id ?? null,
      bid_due_date: '',
      notes: '',
      line_items: [{ client: '', scope_prices: [] }],
    })
    // Belt-and-suspenders: force estimator_id to the current auth user even if
    // useUserRole().profile hasn't loaded yet.
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setValue('estimator_id', data.user.id, { shouldDirty: false })
      }
    })
  }, [open, defaultProjectName, profile?.id, reset, setValue])

  const watchedItems = watch('line_items')
  const totalPreview = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (item.scope_prices ?? []).reduce((s, sp) => {
      const p = parseFloat(sp.price ?? '')
      return s + (isNaN(p) ? 0 : p)
    }, 0)
  }, 0)
  const hasAnyPrice = (watchedItems ?? []).some((item) =>
    (item.scope_prices ?? []).some((sp) => {
      const p = parseFloat(sp.price ?? '')
      return !isNaN(p)
    })
  )

  async function onSubmit(values: NewBidForm) {
    setSubmitting(true)
    const supabase = createClient()

    const status = createAsUnassigned ? 'Unassigned' : 'Bidding'
    const estimator_id = createAsUnassigned ? null : (values.estimator_id ?? null)

    const { data: bidData, error: bidError } = await supabase
      .from('bids')
      .insert({
        project_name: values.project_name,
        branch: values.branch,
        bid_due_date: values.bid_due_date,
        notes: values.notes || null,
        status,
        estimator_id,
      })
      .select('id')
      .single()

    if (bidError || !bidData) {
      setSubmitting(false)
      toast.error('Failed to create bid. Please try again.')
      return
    }

    const bidId = bidData.id

    if (profile) await logActivity(bidId, profile.id, 'Created bid')

    // Expand: one record per client+scope, with the price entered for that scope
    const lineItemsToInsert = values.line_items.flatMap((li) =>
      li.scope_prices.map((sp) => ({
        bid_id: bidId,
        client: li.client,
        scope: sp.scope,
        price: sp.price?.trim() ? parseFloat(sp.price) : null,
      }))
    )

    const { error: liError } = await supabase.from('bid_line_items').insert(lineItemsToInsert)

    if (liError) {
      await supabase.from('bids').delete().eq('id', bidId)
      setSubmitting(false)
      toast.error('Failed to save line items. Please try again.')
      return
    }

    setSubmitting(false)
    toast.success('Bid created successfully.')
    setCreateAsUnassigned(false)
    reset({
      project_name: '',
      branch: '' as any,
      estimator_id: profile?.id ?? null,
      bid_due_date: '',
      notes: '',
      line_items: [{ client: '', scope_prices: [] }],
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger
          render={
            <Button
              style={{
                background: '#2563EB',
                color: '#fff',
                fontWeight: 500,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#1D4ED8' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#2563EB' }}
            >
              <PlusIcon />
              New Bid
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Bid</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Project Name */}
          <div className="space-y-1">
            <Label htmlFor="project_name">Project Name</Label>
            <Input
              id="project_name"
              {...register('project_name')}
              placeholder="Project name"
            />
            {errors.project_name && (
              <p className="text-xs text-destructive">{errors.project_name.message}</p>
            )}
          </div>

          {/* Branch + Bid Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Branch</Label>
              <Controller
                name="branch"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map((b) => (
                        <SelectItem key={b} value={b}>{BRANCH_LABELS[b]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.branch && (
                <p className="text-xs text-destructive">{errors.branch.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="bid_due_date">Bid Due Date</Label>
              <Controller
                name="bid_due_date"
                control={control}
                render={({ field }) => (
                  <SmartDateInput
                    id="bid_due_date"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                )}
              />
              {errors.bid_due_date && (
                <p className="text-xs text-destructive">{errors.bid_due_date.message}</p>
              )}
            </div>
          </div>

          {/* Estimator + Create as Unassigned */}
          {!createAsUnassigned && (
            <div className="space-y-1">
              <Label>Estimator</Label>
              <Controller
                name="estimator_id"
                control={control}
                render={({ field }) => {
                  const displayName = profiles.find(p => p.id === field.value)?.name
                  return (
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger className="w-full">
                        {displayName
                          ? <span>{displayName}</span>
                          : <span className="italic text-muted-foreground">Unassigned</span>
                        }
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="italic text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }}
              />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text2)' }}>
            <input
              type="checkbox"
              checked={createAsUnassigned}
              onChange={(e) => setCreateAsUnassigned(e.target.checked)}
              style={{ accentColor: 'var(--accent2)', width: 15, height: 15 }}
            />
            Create as Unassigned
          </label>

          {/* Line Items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            {errors.line_items?.root && (
              <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
            )}
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs text-muted-foreground px-1">
                <span>Client</span>
                <span>Scope(s)</span>
                <span />
              </div>

              {fields.map((field, index) => {
                const scopePrices = watchedItems?.[index]?.scope_prices ?? []
                return (
                  <div key={field.id} className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_32px] gap-2 items-start">
                      <div>
                        <Input
                          {...register(`line_items.${index}.client`)}
                          placeholder="Client name"
                          className="h-8 text-sm"
                        />
                        {errors.line_items?.[index]?.client && (
                          <p className="text-xs text-destructive mt-0.5">
                            {errors.line_items[index]?.client?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Controller
                          name={`line_items.${index}.scope_prices`}
                          control={control}
                          render={({ field: spField }) => {
                            const selectedScopes = (spField.value ?? []).map((sp) => sp.scope)
                            return (
                              <ScopePicker
                                selected={selectedScopes}
                                onChange={(nextScopes) => {
                                  const existing = new Map(
                                    (spField.value ?? []).map((sp) => [sp.scope, sp.price])
                                  )
                                  spField.onChange(
                                    nextScopes.map((s) => ({ scope: s, price: existing.get(s) ?? '' }))
                                  )
                                }}
                                error={!!errors.line_items?.[index]?.scope_prices}
                              />
                            )
                          }}
                        />
                        {errors.line_items?.[index]?.scope_prices && (
                          <p className="text-xs text-destructive mt-0.5">
                            At least one scope required
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label="Remove line item"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>

                    {scopePrices.length > 0 && (
                      <div className="space-y-1 pl-1">
                        {scopePrices.map((sp, spIdx) => (
                          <div key={sp.scope} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                            <span className="text-sm text-muted-foreground">{sp.scope}</span>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={sp.price}
                              onChange={(e) => {
                                const next = scopePrices.map((row, i) =>
                                  i === spIdx ? { ...row, price: e.target.value } : row
                                )
                                setValue(`line_items.${index}.scope_prices`, next, {
                                  shouldValidate: true,
                                })
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ client: '', scope_prices: [] })}
            >
              <PlusIcon className="size-3.5" />
              Add Client
            </Button>

            {/* Total price preview */}
            <div className="flex items-center justify-end pt-1 border-t">
              <span className="text-sm text-muted-foreground mr-2">Total:</span>
              <span className="text-sm font-medium">
                {hasAnyPrice
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalPreview)
                  : 'TBD'}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes…"
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Bid'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
