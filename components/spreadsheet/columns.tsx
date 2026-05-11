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
import { ScopeEditor } from './ScopeEditor'
import { ClientsPopover } from './ClientsPopover'
import { InlineDateCell } from '@/components/bids/InlineDateCell'
import { InlineStatusCell } from '@/components/bids/InlineStatusCell'
import { InlineEstimatorCell } from '@/components/bids/InlineEstimatorCell'

// Augment TanStack Table meta so cells can call updateBid
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateBid: (
      id: string,
      field: 'notes' | 'project_location' | 'mike_estimate_number',
      value: string | null
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

function dueDateStyle(dateStr: string): React.CSSProperties {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return { color: '#A32D2D', fontWeight: 600 } // overdue or due today
  if (diffDays <= 5) return { color: '#854F0B', fontWeight: 600 } // within 5 days
  return {}
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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
      className="block w-full text-left truncate rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
      onClick={startEdit}
      title={defaultValue || 'Click to edit'}
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
          <DropdownMenuItem onClick={() => onEdit(bid)}>
            <PencilIcon className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
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
  currentUserId: string | null
}

export function createColumns({ onOpenBid, onEdit, currentUserId }: ColumnCallbacks): ColumnDef<Bid>[] {
  return [
    // 1. Project Name
    {
      accessorKey: 'project_name',
      size: 320,
      minSize: 240,
      maxSize: 400,
      header: ({ column }) => <SortableHeader label="Project Name" column={column} />,
      cell: ({ row }) => (
        <button
          className="block w-full font-medium text-left truncate hover:underline text-primary"
          onClick={() => onOpenBid(row.original)}
          title={row.original.project_name}
        >
          {row.original.project_name}
        </button>
      ),
    },
    // 1b. Project Location (inline editable, hidden by default)
    {
      accessorKey: 'project_location',
      size: 200,
      minSize: 140,
      maxSize: 240,
      header: ({ column }) => <SortableHeader label="Project Location" column={column} />,
      cell: ({ row, table }) => (
        <InlineEditCell
          defaultValue={row.original.project_location ?? ''}
          type="text"
          placeholder="City, State…"
          onSave={async (raw) => {
            const value = raw.trim() === '' ? null : raw.trim()
            await table.options.meta?.updateBid(row.original.id, 'project_location', value)
          }}
          renderDisplay={(raw) => (
            <span className={raw === '' ? 'italic text-muted-foreground text-xs' : 'text-sm'}>
              {raw === '' ? 'Add location…' : raw}
            </span>
          )}
        />
      ),
    },
    // 2. Scope (click to open pricing popover)
    {
      id: 'scope',
      size: 180,
      minSize: 140,
      maxSize: 240,
      header: ({ column }) => <SortableHeader label="Scope" column={column} />,
      cell: ({ row }) => (
        <div className="truncate">
          <ScopeEditor bid={row.original} />
        </div>
      ),
    },
    // 3. Bid Price (computed, never editable)
    {
      id: 'total_price',
      size: 120,
      minSize: 100,
      maxSize: 160,
      header: ({ column }) => <SortableHeader label="Bid Price" column={column} />,
      cell: ({ row }) => {
        const hasPrice = (row.original.line_items ?? []).some((li) => li.price !== null)
        const display = hasPrice ? formatCurrency(row.original.total_price ?? 0) : 'TBD'
        return (
          <span
            style={{ fontWeight: 500, fontSize: 15 }}
            className={`block truncate ${hasPrice ? '' : 'italic text-muted-foreground'}`}
            title={display}
          >
            {display}
          </span>
        )
      },
    },
    // 3b. MIKE Estimate # (inline editable, hidden by default)
    {
      accessorKey: 'mike_estimate_number',
      size: 110,
      minSize: 90,
      maxSize: 130,
      header: ({ column }) => <SortableHeader label="MIKE #" column={column} />,
      cell: ({ row, table }) => (
        <InlineEditCell
          defaultValue={row.original.mike_estimate_number ?? ''}
          type="text"
          placeholder="MIKE #"
          onSave={async (raw) => {
            const value = raw.trim() === '' ? null : raw.trim()
            await table.options.meta?.updateBid(row.original.id, 'mike_estimate_number', value)
          }}
          renderDisplay={(raw) => (
            <span
              className={raw === '' ? 'italic text-muted-foreground text-xs' : 'text-sm'}
              style={raw === '' ? undefined : { fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
            >
              {raw === '' ? 'Add MIKE #…' : `#${raw}`}
            </span>
          )}
        />
      ),
    },
    // 4. Bid Due Date (inline editable)
    {
      accessorKey: 'bid_due_date',
      size: 120,
      minSize: 80,
      maxSize: 140,
      header: ({ column }) => <SortableHeader label="Bid Due Date" column={column} />,
      cell: ({ row }) => (
        <InlineDateCell
          bidId={row.original.id}
          userId={currentUserId}
          projectName={row.original.project_name}
          initialDate={row.original.bid_due_date}
          displayClassName="block w-full text-left truncate rounded px-1 -mx-1 hover:bg-muted/60 transition-colors"
          displayStyle={
            row.original.bid_due_date ? dueDateStyle(row.original.bid_due_date) : undefined
          }
        />
      ),
    },
    // 5. Status (inline editable)
    {
      accessorKey: 'status',
      size: 110,
      minSize: 80,
      maxSize: 140,
      header: ({ column }) => <SortableHeader label="Status" column={column} />,
      cell: ({ row }) => (
        <InlineStatusCell
          bidId={row.original.id}
          userId={currentUserId}
          projectName={row.original.project_name}
          initialStatus={row.original.status}
        />
      ),
    },
    // 6. Estimator (inline editable)
    {
      accessorKey: 'estimator_name',
      size: 140,
      minSize: 110,
      maxSize: 180,
      header: ({ column }) => <SortableHeader label="Estimator" column={column} />,
      cell: ({ row }) => (
        <InlineEstimatorCell
          bidId={row.original.id}
          userId={currentUserId}
          projectName={row.original.project_name}
          initialEstimatorId={row.original.estimator_id}
          initialEstimatorName={row.original.estimator_name}
        />
      ),
    },
    // 7. Client(s) (click to open multi-client popover)
    {
      id: 'client',
      size: 180,
      minSize: 140,
      maxSize: 240,
      header: ({ column }) => <SortableHeader label="Client(s)" column={column} />,
      cell: ({ row }) => (
        <div className="truncate">
          <ClientsPopover bid={row.original} />
        </div>
      ),
    },
    // 8. Branch
    {
      accessorKey: 'branch',
      size: 100,
      minSize: 80,
      maxSize: 140,
      header: ({ column }) => <SortableHeader label="Branch" column={column} />,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground" title={row.original.branch}>
          {row.original.branch}
        </span>
      ),
      filterFn: 'equals',
    },
    // 9. Notes (inline editable)
    {
      accessorKey: 'notes',
      size: 220,
      minSize: 140,
      maxSize: 320,
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
    // 10. Actions
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell row={row} onEdit={onEdit} />,
      enableSorting: false,
    },
  ]
}
