'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const newBidSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client: z.string().min(1, 'Client is required'),
  scope: z.enum(['Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other']),
  branch: z.enum(['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4', 'Branch 5']),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
  bid_price: z.string().optional(),
  notes: z.string().optional(),
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
    formState: { errors },
  } = useForm<NewBidForm>({
    resolver: zodResolver(newBidSchema),
  })

  async function onSubmit(values: NewBidForm) {
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('bids').insert({
      project_name: values.project_name,
      client: values.client,
      scope: values.scope,
      branch: values.branch,
      bid_due_date: values.bid_due_date,
      bid_price: values.bid_price ? parseFloat(values.bid_price) : null,
      notes: values.notes || null,
      status: 'Unassigned',
    })

    setSubmitting(false)

    if (error) {
      toast.error('Failed to create bid. Please try again.')
      return
    }

    toast.success('Bid created successfully.')
    reset()
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Bid</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
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

          <div className="space-y-1">
            <Label htmlFor="client">Client</Label>
            <Input id="client" {...register('client')} placeholder="Client name" />
            {errors.client && (
              <p className="text-xs text-destructive">{errors.client.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Scope</Label>
              <Controller
                name="scope"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other'] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.scope && (
                <p className="text-xs text-destructive">{errors.scope.message}</p>
              )}
            </div>

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
                      {(
                        [
                          'Branch 1',
                          'Branch 2',
                          'Branch 3',
                          'Branch 4',
                          'Branch 5',
                        ] as const
                      ).map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.branch && (
                <p className="text-xs text-destructive">{errors.branch.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bid_due_date">Bid Due Date</Label>
            <Input id="bid_due_date" type="date" {...register('bid_due_date')} />
            {errors.bid_due_date && (
              <p className="text-xs text-destructive">{errors.bid_due_date.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="bid_price">Bid Price (optional)</Label>
            <Input
              id="bid_price"
              type="number"
              step="0.01"
              min="0"
              {...register('bid_price')}
              placeholder="0.00"
            />
          </div>

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
