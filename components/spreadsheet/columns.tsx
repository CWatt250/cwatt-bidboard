'use client'

import { type ColumnDef, type Row } from '@tanstack/react-table'
import { ArrowUpDownIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Bid } from '@/hooks/useBids'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  SCOPE_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  DUE_DATE_URGENT_CLASS,
  DUE_DATE_WARNING_CLASS,
} from '@/config/colors'

function SortableHeader({ label, column }: { label: string; column: any }) {
  return (
    <button
      className="flex items-center gap-1 text-left font-medium text-foreground hover:text-foreground/80 transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDownIcon className="size-3 text-muted-foreground" />
    </button>
  )
}

function dueDateClass(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return DUE_DATE_URGENT_CLASS
  if (diffDays <= 7) return DUE_DATE_WARNING_CLASS
  return ''
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'TBD'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ActionsCell({ row, onEdit }: { row: Row<Bid>; onEdit: (bid: Bid) => void }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bid = row.original

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('bids').delete().eq('id', bid.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete bid.')
      return
    }
    toast.success('Bid deleted.')
    setDeleteOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Actions">
              <MoreHorizontalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(bid)}>
            <PencilIcon className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{bid.project_name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface ColumnCallbacks {
  onOpenBid: (bid: Bid) => void
  onEdit: (bid: Bid) => void
}

export function createColumns({ onOpenBid, onEdit }: ColumnCallbacks): ColumnDef<Bid>[] {
  return [
    {
      accessorKey: 'project_name',
      header: ({ column }) => <SortableHeader label="Project Name" column={column} />,
      cell: ({ row }) => (
        <button
          className="font-medium text-left hover:underline text-primary"
          onClick={() => onOpenBid(row.original)}
        >
          {row.original.project_name}
        </button>
      ),
    },
    {
      accessorKey: 'client',
      header: ({ column }) => <SortableHeader label="Client" column={column} />,
      cell: ({ row }) => <span>{row.original.client}</span>,
    },
    {
      accessorKey: 'scope',
      header: ({ column }) => <SortableHeader label="Scope" column={column} />,
      cell: ({ row }) => (
        <Badge className={SCOPE_BADGE_CLASSES[row.original.scope]} variant="outline">
          {row.original.scope}
        </Badge>
      ),
    },
    {
      accessorKey: 'branch',
      header: ({ column }) => <SortableHeader label="Branch" column={column} />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branch}</span>,
      filterFn: 'equals',
    },
    {
      accessorKey: 'estimator_name',
      header: ({ column }) => <SortableHeader label="Estimator" column={column} />,
      cell: ({ row }) =>
        row.original.estimator_name ? (
          <span>{row.original.estimator_name}</span>
        ) : (
          <span className="italic text-muted-foreground">Unassigned</span>
        ),
    },
    {
      accessorKey: 'bid_price',
      header: ({ column }) => <SortableHeader label="Bid Price" column={column} />,
      cell: ({ row }) => (
        <span className={row.original.bid_price === null ? 'italic text-muted-foreground' : 'font-medium'}>
          {formatCurrency(row.original.bid_price)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <SortableHeader label="Status" column={column} />,
      cell: ({ row }) => (
        <Badge className={STATUS_BADGE_CLASSES[row.original.status]} variant="outline">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'bid_due_date',
      header: ({ column }) => <SortableHeader label="Bid Due Date" column={column} />,
      cell: ({ row }) => (
        <span className={dueDateClass(row.original.bid_due_date)}>
          {formatDate(row.original.bid_due_date)}
        </span>
      ),
    },
    {
      accessorKey: 'project_start_date',
      header: ({ column }) => <SortableHeader label="Project Start" column={column} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.project_start_date)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell row={row} onEdit={onEdit} />,
      enableSorting: false,
    },
  ]
}
