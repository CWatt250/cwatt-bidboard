'use client'

import { XIcon } from 'lucide-react'
import type { BidStatus, BidScope } from '@/lib/supabase/types'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export type DueDateFilter = 'all' | 'overdue' | 'this-week' | 'this-month'
export type EstimatorFilter = 'mine' | 'unassigned' | 'all' | string

const ALL_STATUSES: BidStatus[] = [
  'Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost',
]
const ALL_BRANCHES = ['PSC', 'SEA', 'POR', 'PHX', 'SLC'] as const
const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other',
]
const DUE_DATE_OPTIONS: { label: string; value: DueDateFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due This Week', value: 'this-week' },
  { label: 'Due This Month', value: 'this-month' },
]

export interface ActiveFilters {
  statuses: Set<BidStatus>
  branches: Set<string>
  scopes: Set<BidScope>
  dueDate: DueDateFilter
}

interface FilterBarProps {
  filters: ActiveFilters
  onChange: (next: ActiveFilters) => void
  estimatorFilter: EstimatorFilter
  onEstimatorFilterChange: (next: EstimatorFilter) => void
  estimators: { id: string; name: string }[]
  canSeeAllEstimators: boolean
}

function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set)
  if (next.has(item)) next.delete(item)
  else next.add(item)
  return next
}

function activeCount(filters: ActiveFilters): number {
  return (
    (filters.statuses.size > 0 ? 1 : 0) +
    (filters.branches.size > 0 ? 1 : 0) +
    (filters.scopes.size > 0 ? 1 : 0) +
    (filters.dueDate !== 'all' ? 1 : 0)
  )
}

function FilterChip({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            style={{
              fontSize: '0.72rem',
              height: 28,
              gap: 4,
              paddingLeft: 8,
              paddingRight: 8,
              fontWeight: count > 0 ? 600 : 400,
              borderColor: count > 0 ? 'var(--accent)' : undefined,
              color: count > 0 ? 'var(--accent)' : undefined,
            }}
          />
        }
      >
        {label}
        {count > 0 && (
          <span
            style={{
              background: 'var(--accent)',
              color: 'white',
              borderRadius: '100px',
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '0 4px',
              lineHeight: '16px',
              minWidth: 16,
              textAlign: 'center',
              display: 'inline-block',
            }}
          >
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FilterBar({
  filters,
  onChange,
  estimatorFilter,
  onEstimatorFilterChange,
  estimators,
  canSeeAllEstimators,
}: FilterBarProps) {
  const total = activeCount(filters) + (estimatorFilter !== 'mine' ? 1 : 0)

  const estimatorLabel = (() => {
    if (estimatorFilter === 'mine') return 'My Bids'
    if (estimatorFilter === 'unassigned') return 'Unassigned'
    if (estimatorFilter === 'all') return 'All Bids'
    return estimators.find((e) => e.id === estimatorFilter)?.name ?? 'Estimator'
  })()

  function clearAll() {
    onChange({
      statuses: new Set(),
      branches: new Set(),
      scopes: new Set(),
      dueDate: 'all',
    })
    onEstimatorFilterChange('mine')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Status */}
      <FilterChip label="Status" count={filters.statuses.size}>
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_STATUSES.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={filters.statuses.has(s)}
            onCheckedChange={() =>
              onChange({ ...filters, statuses: toggleSetItem(filters.statuses, s) })
            }
          >
            {s}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Branch */}
      <FilterChip label="Branch" count={filters.branches.size}>
        <DropdownMenuLabel>Branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_BRANCHES.map((b) => (
          <DropdownMenuCheckboxItem
            key={b}
            checked={filters.branches.has(b)}
            onCheckedChange={() =>
              onChange({ ...filters, branches: toggleSetItem(filters.branches, b) })
            }
          >
            {b}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Scope */}
      <FilterChip label="Scope" count={filters.scopes.size}>
        <DropdownMenuLabel>Scope</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_SCOPES.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={filters.scopes.has(s)}
            onCheckedChange={() =>
              onChange({ ...filters, scopes: toggleSetItem(filters.scopes, s) })
            }
          >
            {s}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Estimator */}
      <FilterChip
        label={estimatorLabel}
        count={estimatorFilter !== 'mine' ? 1 : 0}
      >
        <DropdownMenuLabel>Estimator</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={estimatorFilter === 'mine'}
          onCheckedChange={() => onEstimatorFilterChange('mine')}
        >
          My Bids
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={estimatorFilter === 'unassigned'}
          onCheckedChange={() => onEstimatorFilterChange('unassigned')}
        >
          Unassigned
        </DropdownMenuCheckboxItem>
        {canSeeAllEstimators && (
          <>
            <DropdownMenuCheckboxItem
              checked={estimatorFilter === 'all'}
              onCheckedChange={() => onEstimatorFilterChange('all')}
            >
              All Bids
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {estimators.map((e) => (
              <DropdownMenuCheckboxItem
                key={e.id}
                checked={estimatorFilter === e.id}
                onCheckedChange={() => onEstimatorFilterChange(e.id)}
              >
                {e.name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </FilterChip>

      {/* Due Date */}
      <FilterChip
        label="Due Date"
        count={filters.dueDate !== 'all' ? 1 : 0}
      >
        <DropdownMenuLabel>Due Date</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DUE_DATE_OPTIONS.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={filters.dueDate === opt.value}
            onCheckedChange={() =>
              onChange({
                ...filters,
                dueDate: opt.value === filters.dueDate ? 'all' : opt.value,
              })
            }
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Clear all */}
      {total > 0 && (
        <button
          onClick={clearAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: '0.72rem',
            color: 'var(--text3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 4px',
          }}
          className="hover:text-foreground transition-colors"
        >
          <XIcon className="size-3" />
          Clear ({total})
        </button>
      )}
    </div>
  )
}
