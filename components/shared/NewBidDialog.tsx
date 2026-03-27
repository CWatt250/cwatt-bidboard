'use client'

import { useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

const lineItemSchema = z.object({
  client: z.string().min(1, 'Client is required'),
  scope: z.enum(SCOPES, { error: 'Scope is required' }),
  price: z.string().optional(),
})

const newBidSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  branch: z.enum(BRANCHES),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type NewBidForm = z.infer<typeof newBidSchema>

export function NewBidDialog() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<NewBidForm>({
    resolver: zodResolver(newBidSchema),
    defaultValues: {
      line_items: [{ client: '', scope: undefined, price: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const watchedItems = watch('line_items')
  const totalPreview = (watchedItems ?? []).reduce((sum, item) => {
    const p = parseFloat(item.price ?? '')
    return sum + (isNaN(p) ? 0 : p)
  }, 0)
  const hasAnyPrice = (watchedItems ?? []).some((item) => {
    const p = parseFloat(item.price ?? '')
    return !isNaN(p)
  })

  async function onSubmit(values: NewBidForm) {
    setSubmitting(true)
    const supabase = createClient()

    // Insert the parent bid first
    const { data: bidData, error: bidError } = await supabase
      .from('bids')
      .insert({
        project_name: values.project_name,
        branch: values.branch,
        bid_due_date: values.bid_due_date,
        notes: values.notes || null,
        status: 'Unassigned',
      })
      .select('id')
      .single()

    if (bidError || !bidData) {
      setSubmitting(false)
      toast.error('Failed to create bid. Please try again.')
      return
    }

    const bidId = bidData.id

    // Insert all line items
    const lineItemsToInsert = values.line_items.map((li) => ({
      bid_id: bidId,
      client: li.client,
      scope: li.scope,
      price: li.price?.trim() ? parseFloat(li.price) : null,
    }))

    const { error: liError } = await supabase.from('bid_line_items').insert(lineItemsToInsert)

    if (liError) {
      // Roll back: delete the parent bid (cascade will clean up any partial line items)
      await supabase.from('bids').delete().eq('id', bidId)
      setSubmitting(false)
      toast.error('Failed to save line items. Please try again.')
      return
    }

    setSubmitting(false)
    toast.success('Bid created successfully.')
    reset({
      project_name: '',
      branch: undefined,
      bid_due_date: '',
      notes: '',
      line_items: [{ client: '', scope: undefined, price: '' }],
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon />
            New Bid
          </Button>
        }
      />
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
                    value={field.value}
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

          {/* Line Items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            {errors.line_items?.root && (
              <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
            )}
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_120px_32px] gap-2 text-xs text-muted-foreground px-1">
                <span>Client</span>
                <span>Scope</span>
                <span>Price (optional)</span>
                <span />
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_120px_32px] gap-2 items-start">
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
                      name={`line_items.${index}.scope`}
                      control={control}
                      render={({ field: scopeField }) => (
                        <Select
                          value={scopeField.value}
                          onValueChange={(v) => scopeField.onChange(v)}
                        >
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue placeholder="Select scope" />
                          </SelectTrigger>
                          <SelectContent>
                            {SCOPES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.line_items?.[index]?.scope && (
                      <p className="text-xs text-destructive mt-0.5">
                        {errors.line_items[index]?.scope?.message}
                      </p>
                    )}
                  </div>

                  <Input
                    {...register(`line_items.${index}.price`)}
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    className="h-8 text-sm"
                  />

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
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ client: '', scope: undefined as any, price: '' })}
            >
              <PlusIcon className="size-3.5" />
              Add Line Item
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
