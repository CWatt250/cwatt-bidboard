'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, PencilIcon } from 'lucide-react'
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers'
import { EditUserDrawer } from '@/components/admin/EditUserDrawer'
import { AddUserDialog } from '@/components/admin/AddUserDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { Branch, UserRole } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  branch_manager: 'Branch Manager',
  estimator: 'Estimator',
}

const ROLE_BADGE_VARIANT: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  branch_manager: 'secondary',
  estimator: 'outline',
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <ArrowUp className="ml-1 inline size-3" />
  if (isSorted === 'desc') return <ArrowDown className="ml-1 inline size-3" />
  return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />
}

export default function UsersPage() {
  const { users, loading, error, refetch } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All')
  const [branchFilter, setBranchFilter] = useState<Branch | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [sorting, setSorting] = useState<SortingState>([])
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      if (roleFilter !== 'All' && u.role !== roleFilter) return false
      if (branchFilter !== 'All' && !u.branches.includes(branchFilter)) return false
      if (statusFilter === 'Active' && !u.is_active) return false
      if (statusFilter === 'Inactive' && u.is_active) return false
      return true
    })
  }, [users, search, roleFilter, branchFilter, statusFilter])

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            className="flex items-center font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <button
            className="flex items-center font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Email
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <button
            className="flex items-center font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Role
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <Badge variant={ROLE_BADGE_VARIANT[row.original.role]}>
            {ROLE_LABELS[row.original.role]}
          </Badge>
        ),
      },
      {
        accessorKey: 'branches',
        header: 'Branches',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.branches.map((b) => (
              <Badge key={b} variant="outline" className="text-xs">
                {b}
              </Badge>
            ))}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'is_active',
        header: ({ column }) => (
          <button
            className="flex items-center font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="destructive">Inactive</Badge>
          ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <button
            className="flex items-center font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Joined
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.original.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditingUser(row.original)}
          >
            <PencilIcon className="size-3.5" />
            <span className="sr-only">Edit {row.original.name}</span>
          </Button>
        ),
        enableSorting: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 text-xs"
          />

          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger size="sm" className="h-8 w-40 text-xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Roles</SelectItem>
              <SelectItem value="estimator" className="text-xs">Estimator</SelectItem>
              <SelectItem value="branch_manager" className="text-xs">Branch Manager</SelectItem>
              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
            </SelectContent>
          </Select>

          <Select value={branchFilter} onValueChange={(v) => setBranchFilter(v as typeof branchFilter)}>
            <SelectTrigger size="sm" className="h-8 w-36 text-xs">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Branches</SelectItem>
              {ALL_BRANCHES.map((b) => (
                <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger size="sm" className="h-8 w-32 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Status</SelectItem>
              <SelectItem value="Active" className="text-xs">Active</SelectItem>
              <SelectItem value="Inactive" className="text-xs">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AddUserDialog onCreated={refetch} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">Error loading users: {error}</p>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
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
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground text-sm">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
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

      {/* Row count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {table.getRowModel().rows.length} of {users.length} user{users.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Edit drawer */}
      <EditUserDrawer
        user={editingUser}
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={refetch}
      />
    </div>
  )
}
