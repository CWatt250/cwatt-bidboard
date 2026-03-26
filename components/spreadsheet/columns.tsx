'use client'

import {
  type ColumnDef,
  type Row,
  type RowData,
} from '@tanstack/react-table'
import {
  ArrowUpDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Bid } from '@/hooks/useBids'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

// Augment TanStack Table meta so cells can call updateBid
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateBid: (
      id: string,
      field: 'bid_price' | 'notes' | 'project_start_date',
      value: string | number | null
    ) => Promise<void>
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── InlineEditCell ───────────────────────────────────────────────────────────

interface InlineEditCellProps {
  defaultValue: string
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  onSave: (value: string) => Promise<void>
  renderDisplay: (value: string) => React.ReactNode
}

function InlineEditCell({
  defaultValue,
  type = 'text',
  placeholder,
  onSave,
  renderDisplay,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(defaultValue)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep draft in sync with upstream value when not editing
  useEffect(() => {
    if (!editing) setDraft(defaultValue)
  }, [defaultValue, editing])

  function startEdit() {
    setDraft(defaultValue)
    setEditing(true)
    // focus handled by autoFocus on input
  }

  async function commit() {
    if (draft === defaultValue) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setDraft(defaultValue)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-[120px]">
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={saving}
          className="h-6 text-xs px-1.5 py-0"
          step={type === 'number' ? '1' : undefined}
          min={type === 'number' ? '0' : undefined}
        />
        {saving && (
          <span className="text-xs text-muted-foreground shrink-0">Saving…</span>
        )}
      </div>
    )
  }

  return (
    <button
      className="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
      onClick={startEdit}
      title="Click to edit"
    >
      {renderDisplay(defaultValue)}
    </button>
  )
}

// ─── ActionsCell ──────────────────────────────────────────────────────────────

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

// ─── Column Definitions ───────────────────────────────────────────────────────

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
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.branch}</span>
      ),
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
    // ── Inline editable: Bid Price ──
    {
      accessorKey: 'bid_price',
      header: ({ column }) => <SortableHeader label="Bid Price" column={column} />,
      cell: ({ row, table }) => (
        <InlineEditCell
          defaultValue={row.original.bid_price?.toString() ?? ''}
          type="number"
          placeholder="0"
          onSave={async (raw) => {
            const value = raw.trim() === '' ? null : parseFloat(raw)
            await table.options.meta?.updateBid(row.original.id, 'bid_price', value ?? null)
          }}
          renderDisplay={(raw) => (
            <span className={raw === '' ? 'italic text-muted-foreground' : 'font-medium'}>
              {raw === '' ? 'TBD' : formatCurrency(parseFloat(raw))}
            </span>
          )}
        />
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
    // ── Inline editable: Project Start Date ──
    {
      accessorKey: 'project_start_date',
      header: ({ column }) => <SortableHeader label="Project Start" column={column} />,
      cell: ({ row, table }) => (
        <InlineEditCell
          defaultValue={row.original.project_start_date ?? ''}
          type="date"
          onSave={async (raw) => {
            const value = raw.trim() === '' ? null : raw
            await table.options.meta?.updateBid(row.original.id, 'project_start_date', value)
          }}
          renderDisplay={(raw) => (
            <span className="text-muted-foreground">{formatDate(raw || null)}</span>
          )}
        />
      ),
    },
    // ── Inline editable: Notes ──
    {
      accessorKey: 'notes',
      header: ({ column }) => <SortableHeader label="Notes" column={column} />,
      cell: ({ row, table }) => (
        <InlineEditCell
          defaultValue={row.original.notes ?? ''}
          type="text"
          placeholder="Add notes…"
          onSave={async (raw) => {
            const value = raw.trim() === '' ? null : raw.trim()
            await table.options.meta?.updateBid(row.original.id, 'notes', value)
          }}
          renderDisplay={(raw) => (
            <span className={raw === '' ? 'italic text-muted-foreground text-xs' : 'text-sm'}>
              {raw === '' ? 'Add notes…' : raw}
            </span>
          )}
        />
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
