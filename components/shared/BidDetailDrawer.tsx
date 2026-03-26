'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { STATUS_BADGE_CLASSES } from '@/config/colors'
import type { BidStatus } from '@/hooks/useBids'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const bidDetailSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client: z.string().min(1, 'Client is required'),
  scope: z.enum([
    'Plumbing Piping',
    'HVAC Piping',
    'HVAC Ductwork',
    'Fire Stopping',
    'Equipment',
    'Other',
  ]),
  branch: z.enum(['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4', 'Branch 5']),
  status: z.enum(['Unassigned', 'Bidding', 'In Progress', 'Sent']),
  estimator_id: z.string().nullable().optional(),
  bid_price: z.string().optional(),
  bid_due_date: z.string().min(1, 'Bid due date is required'),
  project_start_date: z.string().optional(),
  notes: z.string().optional(),
})

type BidDetailForm = z.infer<typeof bidDetailSchema>

// ─── DeleteConfirmDialog ──────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  deleting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectName: string
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete bid?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{projectName}</strong>? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── BidDetailDrawer ──────────────────────────────────────────────────────────

export function BidDetailDrawer() {
  const { selectedBid, profiles, closeBid } = useBidDetail()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BidDetailForm>({
    resolver: zodResolver(bidDetailSchema),
  })

  // Re-populate form whenever the selected bid changes
  useEffect(() => {
    if (!selectedBid) return
    reset({
      project_name: selectedBid.project_name,
      client: selectedBid.client,
      scope: selectedBid.scope,
      branch: selectedBid.branch,
      status: selectedBid.status,
      estimator_id: selectedBid.estimator_id ?? undefined,
      bid_price: selectedBid.bid_price?.toString() ?? '',
      bid_due_date: selectedBid.bid_due_date,
      project_start_date: selectedBid.project_start_date ?? '',
      notes: selectedBid.notes ?? '',
    })
  }, [selectedBid, reset])

  async function onSubmit(values: BidDetailForm) {
    if (!selectedBid) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('bids')
      .update({
        project_name: values.project_name,
        client: values.client,
        scope: values.scope,
        branch: values.branch,
        status: values.status,
        estimator_id: values.estimator_id ?? null,
        bid_price: values.bid_price?.trim()
          ? parseFloat(values.bid_price)
          : null,
        bid_due_date: values.bid_due_date,
        project_start_date: values.project_start_date?.trim() || null,
        notes: values.notes?.trim() || null,
      })
      .eq('id', selectedBid.id)
    setSaving(false)
    if (error) {
      toast.error('Failed to save changes. Please try again.')
      return
    }
    toast.success('Bid updated successfully.')
    closeBid()
  }

  async function handleDelete() {
    if (!selectedBid) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('bids').delete().eq('id', selectedBid.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete bid.')
      return
    }
    toast.success('Bid deleted.')
    setDeleteOpen(false)
    closeBid()
  }

  const isOpen = selectedBid !== null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeBid() }}>
        <SheetContent>
          {/* Header */}
          <SheetHeader>
            <div className="flex flex-col gap-1.5 min-w-0">
              <SheetTitle>{selectedBid?.project_name ?? ''}</SheetTitle>
              {selectedBid && (
                <Badge
                  className={STATUS_BADGE_CLASSES[selectedBid.status as BidStatus]}
                  variant="outline"
                >
                  {selectedBid.status}
                </Badge>
              )}
            </div>
            <SheetClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetClose>
          </SheetHeader>

          {/* Body */}
          {selectedBid && (
            <form
              id="bid-detail-form"
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-1 overflow-hidden"
            >
              {/* Main fields */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Project Name */}
                <div className="space-y-1">
                  <Label htmlFor="dd-project_name">Project Name</Label>
                  <Input
                    id="dd-project_name"
                    {...register('project_name')}
                    placeholder="Project name"
                  />
                  {errors.project_name && (
                    <p className="text-xs text-destructive">{errors.project_name.message}</p>
                  )}
                </div>

                {/* Client */}
                <div className="space-y-1">
                  <Label htmlFor="dd-client">Client</Label>
                  <Input
                    id="dd-client"
                    {...register('client')}
                    placeholder="Client name"
                  />
                  {errors.client && (
                    <p className="text-xs text-destructive">{errors.client.message}</p>
                  )}
                </div>

                {/* Scope + Branch */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Scope</Label>
                    <Controller
                      name="scope"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => field.onChange(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select scope" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                'Plumbing Piping',
                                'HVAC Piping',
                                'HVAC Ductwork',
                                'Fire Stopping',
                                'Equipment',
                                'Other',
                              ] as const
                            ).map((s) => (
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
                          onValueChange={(v) => field.onChange(v)}
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

                {/* Status + Estimator */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => field.onChange(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                'Unassigned',
                                'Bidding',
                                'In Progress',
                                'Sent',
                              ] as const
                            ).map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.status && (
                      <p className="text-xs text-destructive">{errors.status.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label>Estimator</Label>
                    <Controller
                      name="estimator_id"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ?? '__none__'}
                          onValueChange={(v) =>
                            field.onChange(v === '__none__' ? null : v)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="italic text-muted-foreground">
                                Unassigned
                              </span>
                            </SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Bid Price */}
                <div className="space-y-1">
                  <Label htmlFor="dd-bid_price">Bid Price (optional)</Label>
                  <Input
                    id="dd-bid_price"
                    type="number"
                    step="1"
                    min="0"
                    {...register('bid_price')}
                    placeholder="0"
                  />
                </div>

                {/* Bid Due Date + Project Start Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="dd-bid_due_date">Bid Due Date</Label>
                    <Input
                      id="dd-bid_due_date"
                      type="date"
                      {...register('bid_due_date')}
                    />
                    {errors.bid_due_date && (
                      <p className="text-xs text-destructive">
                        {errors.bid_due_date.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dd-project_start_date">
                      Project Start Date (optional)
                    </Label>
                    <Input
                      id="dd-project_start_date"
                      type="date"
                      {...register('project_start_date')}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label htmlFor="dd-notes">Notes (optional)</Label>
                  <textarea
                    id="dd-notes"
                    {...register('notes')}
                    placeholder="Additional notes…"
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Right Sidebar — activity log placeholder */}
              <div className="w-64 shrink-0 border-l bg-muted/30 px-4 py-4 overflow-y-auto hidden lg:block">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Activity
                </p>
                <p className="text-sm text-muted-foreground italic">
                  Activity log coming soon
                </p>
              </div>
            </form>
          )}

          {/* Footer */}
          <SheetFooter>
            <Button
              variant="destructive"
              type="button"
              onClick={() => setDeleteOpen(true)}
            >
              Delete Bid
            </Button>
            <div className="flex-1" />
            <SheetClose
              render={<Button variant="outline" type="button" />}
            >
              Cancel
            </SheetClose>
            <Button
              type="submit"
              form="bid-detail-form"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {selectedBid && (
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          projectName={selectedBid.project_name}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </>
  )
}
