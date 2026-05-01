'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type FilterFn,
} from '@tanstack/react-table'
import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { GhostRow } from './GhostRow'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  SearchIcon,
} from 'lucide-react'
import type { Bid, BidScope, BidStatus } from '@/hooks/useBids'
import { getBidClientName } from '@/lib/supabase/types'
import { createColumns } from './columns'
import { FilterBar, type ActiveFilters, type DueDateFilter, type EstimatorFilter } from './FilterBar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PAGE_SIZE = 25

const globalFilterFn: FilterFn<Bid> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase()
  const clientMatch = (row.original.clients ?? []).some((c) =>
    getBidClientName(c).toLowerCase().includes(search)
  )
  return (
    row.original.project_name.toLowerCase().includes(search) ||
    clientMatch ||
    (row.original.estimator_name?.toLowerCase().includes(search) ?? false)
  )
}

interface DataTableProps {
  bids: Bid[]
  loading: boolean
  topBar?: React.ReactNode
  estimatorFilter: EstimatorFilter
  onEstimatorFilterChange: (next: EstimatorFilter) => void
  estimators: { id: string; name: string }[]
  canSeeAllEstimators: boolean
}

function applyLocalFilters(bids: Bid[], filters: ActiveFilters): Bid[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return bids.filter((bid) => {
    // Status
    if (filters.statuses.size > 0 && !filters.statuses.has(bid.status)) return false

    // Branch
    if (filters.branches.size > 0 && !filters.branches.has(bid.branch)) return false

    // Scope
    if (filters.scopes.size > 0) {
      const bidScopes = new Set((bid.line_items ?? []).map((li) => li.scope))
      const hasMatch = [...filters.scopes].some((s) => bidScopes.has(s))
      if (!hasMatch) return false
    }

    // Due Date
    if (filters.dueDate !== 'all' && bid.bid_due_date) {
      const due = new Date(bid.bid_due_date + 'T00:00:00')
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (filters.dueDate === 'overdue' && diffDays >= 0) return false
      if (filters.dueDate === 'this-week' && (diffDays < 0 || diffDays > 7)) return false
      if (filters.dueDate === 'this-month') {
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        if (due < today || due > endOfMonth) return false
      }
    }

    return true
  })
}

export function DataTable({
  bids,
  loading,
  topBar,
  estimatorFilter,
  onEstimatorFilterChange,
  estimators,
  canSeeAllEstimators,
}: DataTableProps) {
  const { openBid } = useBidDetail()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    project_location: true,
    mike_estimate_number: true,
  })
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    statuses: new Set<BidStatus>(),
    branches: new Set<string>(),
    scopes: new Set<BidScope>(),
    dueDate: 'all' as DueDateFilter,
  })

  const columns = useMemo<ColumnDef<Bid>[]>(
    () =>
      createColumns({
        onOpenBid: openBid,
        onEdit: openBid,
      }),
    [openBid]
  )

  const updateBid = useCallback(
    async (
      id: string,
      field: 'notes' | 'project_location' | 'mike_estimate_number',
      value: string | null
    ) => {
      const supabase = createClient()
      const { error } = await supabase.from('bids').update({ [field]: value }).eq('id', id)
      if (error) {
        toast.error('Failed to save changes. Please try again.')
        throw error
      }
    },
    []
  )

  const filteredBids = useMemo(
    () => applyLocalFilters(bids, activeFilters),
    [bids, activeFilters]
  )

  const table = useReactTable<Bid>({
    data: filteredBids,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn,
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    meta: { updateBid },
  })

  const { rows } = table.getRowModel()
  const filteredCount = table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const firstRow = pageIndex * PAGE_SIZE + 1
  const lastRow = Math.min((pageIndex + 1) * PAGE_SIZE, filteredCount)

  const columnLabels: Record<string, string> = {
    project_name: 'Project Name',
    project_location: 'Project Location',
    scope: 'Scope',
    total_price: 'Bid Price',
    mike_estimate_number: 'MIKE #',
    bid_due_date: 'Bid Due Date',
    estimator_name: 'Estimator',
    client: 'Client(s)',
    branch: 'Branch',
    notes: 'Notes',
    status: 'Status',
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
      {topBar}
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search bids…"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              table.setPageIndex(0)
            }}
            className="pl-8"
            style={{ borderRadius: '8px', borderColor: 'var(--border)' }}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline">
                <Columns3Icon />
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                >
                  {columnLabels[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={activeFilters}
        onChange={setActiveFilters}
        estimatorFilter={estimatorFilter}
        onEstimatorFilterChange={onEstimatorFilterChange}
        estimators={estimators}
        canSeeAllEstimators={canSeeAllEstimators}
      />
      </div>

      {/* Table — always-visible horizontal scroll for wide column sets */}
      <div
        className="bidboard-scroll"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Table className="min-w-max">
          <TableHeader style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}
                className="hover:bg-[var(--surface2)]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ color: 'var(--text3)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  style={{ color: 'var(--text3)', textAlign: 'center', padding: '48px 0' }}
                >
                  No bids found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', transition: 'background 120ms ease' }}
                  className="hover:bg-[var(--surface2)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}

            {/* Ghost row — inline excel-style entry */}
            {!loading && (
              <GhostRow
                visibleColumnIds={table.getVisibleLeafColumns().map((c) => c.id)}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
        <span>
          {loading
            ? 'Loading…'
            : filteredCount === 0
              ? '0 bids'
              : `Showing ${firstRow}–${lastRow} of ${filteredCount} bid${filteredCount !== 1 ? 's' : ''}`}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs">
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
