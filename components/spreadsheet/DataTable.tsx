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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  SearchIcon,
} from 'lucide-react'
import type { Bid } from '@/hooks/useBids'
import { createColumns } from './columns'
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
  return (
    row.original.project_name.toLowerCase().includes(search) ||
    row.original.client.toLowerCase().includes(search) ||
    (row.original.estimator_name?.toLowerCase().includes(search) ?? false)
  )
}

interface DataTableProps {
  bids: Bid[]
  loading: boolean
}

export function DataTable({ bids, loading }: DataTableProps) {
  const { openBid } = useBidDetail()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

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
      field: 'notes' | 'project_start_date',
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

  const table = useReactTable<Bid>({
    data: bids,
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
    client: 'Client',
    scope: 'Scope',
    branch: 'Branch',
    estimator_name: 'Estimator',
    total_price: 'Bid Price',
    status: 'Status',
    bid_due_date: 'Bid Due Date',
    project_start_date: 'Project Start',
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                <TableRow key={i}>
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
                  className="h-32 text-center text-muted-foreground"
                >
                  No bids found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
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
