'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter as FilterIcon,
  FolderOpen,
  List as ListIcon,
  ArrowUp,
  ArrowDown,
  X,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import { useBidDetail } from '@/contexts/bidDetail'
import {
  BRANCH_LABELS,
  getBidClientName,
  type Bid,
  type BidLineItem,
  type BidClient,
  type BidScope,
  type BidStatus,
  type Branch,
} from '@/lib/supabase/types'
import {
  STATUS_BADGE_CLASSES,
  BRANCH_BADGE_CLASSES,
} from '@/config/colors'

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const ALL_STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']
const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]

const VIEW_STORAGE_KEY = 'bidwatt:projects-library-view'

type ViewMode = 'folder' | 'list'

interface Filters {
  branches: Branch[]
  years: number[]
  statuses: BidStatus[]
  estimatorIds: string[]
  clients: string[]
  scopes: BidScope[]
  minValue: string
  maxValue: string
  dueStart: string
  dueEnd: string
}

const EMPTY_FILTERS: Filters = {
  branches: [],
  years: [],
  statuses: [],
  estimatorIds: [],
  clients: [],
  scopes: [],
  minValue: '',
  maxValue: '',
  dueStart: '',
  dueEnd: '',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').getFullYear()
}

function bidClientNames(bid: Bid): string[] {
  return (bid.clients ?? []).map(getBidClientName).filter(Boolean)
}

export default function ProjectsLibraryPage() {
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, profile } = useUserRole()
  const { profiles } = useBidDetail()

  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('folder')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [folderPath, setFolderPath] = useState<{ branch?: Branch; year?: number }>({})
  const [sortKey, setSortKey] = useState<'name' | 'due'>('due')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Persisted view preference
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'folder' || stored === 'list') setViewMode(stored)
  }, [])

  function changeView(next: ViewMode) {
    setViewMode(next)
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  // Fetch bids
  const fetchBids = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('bids')
      .select(`
        id,
        project_name,
        branch,
        estimator_id,
        status,
        bid_due_date,
        project_start_date,
        notes,
        created_at,
        updated_at,
        profiles!bids_estimator_id_fkey(name),
        bid_line_items(*),
        bid_clients(*, clients(name))
      `)
      .order('bid_due_date', { ascending: false })

    if (isEstimator && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    } else if (isBranchManager && userBranches.length > 0) {
      query = query.in('branch', userBranches)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      return
    }

    let mapped: Bid[] = (data ?? []).map((row: any) => {
      const line_items: BidLineItem[] = row.bid_line_items ?? []
      const clients: BidClient[] = row.bid_clients ?? []
      const total_price = line_items.reduce((s, li) => s + (li.price ?? 0), 0)
      return {
        ...row,
        estimator_name: row.profiles?.name ?? null,
        line_items,
        clients,
        total_price,
      }
    })

    // Estimator: own bids + unassigned within their branches
    if (isEstimator && profile) {
      mapped = mapped.filter((b) => b.estimator_id === profile.id || b.estimator_id === null)
    }

    setBids(mapped)
    setError(null)
  }, [isEstimator, isBranchManager, userBranches, profile])

  useEffect(() => {
    setLoading(true)
    fetchBids().finally(() => setLoading(false))
  }, [fetchBids])

  useEffect(() => {
    const handler = () => { void fetchBids() }
    window.addEventListener('bidwatt:bid-created', handler)
    return () => window.removeEventListener('bidwatt:bid-created', handler)
  }, [fetchBids])

  // Branches the user can see (for filter and folder Level 1)
  const accessibleBranches = useMemo<Branch[]>(() => {
    if (isAdmin) return ALL_BRANCHES
    return ALL_BRANCHES.filter((b) => userBranches.includes(b))
  }, [isAdmin, userBranches])

  // Estimator options (respect role scope)
  const estimatorOptions = useMemo(() => {
    if (isAdmin) return profiles
    if (isBranchManager) {
      return profiles.filter((p) =>
        (p.branches ?? []).some((b) => userBranches.includes(b as Branch))
      )
    }
    return profiles.filter((p) => p.id === profile?.id)
  }, [isAdmin, isBranchManager, userBranches, profiles, profile])

  // Distinct option values derived from loaded bids
  const allYears = useMemo(() => {
    const set = new Set<number>()
    for (const b of bids) {
      const y = yearOf(b.bid_due_date)
      if (y) set.add(y)
    }
    return [...set].sort((a, b) => b - a)
  }, [bids])

  const allClients = useMemo(() => {
    const set = new Set<string>()
    for (const b of bids) for (const c of bidClientNames(b)) set.add(c)
    return [...set].sort()
  }, [bids])

  // Apply filters + search
  const filteredBids = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const min = filters.minValue ? parseFloat(filters.minValue) : null
    const max = filters.maxValue ? parseFloat(filters.maxValue) : null

    return bids.filter((b) => {
      if (q && !b.project_name.toLowerCase().includes(q)) return false
      if (filters.branches.length && !filters.branches.includes(b.branch)) return false
      if (filters.statuses.length && !filters.statuses.includes(b.status)) return false
      if (filters.estimatorIds.length) {
        const id = b.estimator_id ?? '__unassigned__'
        if (!filters.estimatorIds.includes(id)) return false
      }
      if (filters.years.length) {
        const y = yearOf(b.bid_due_date)
        if (!y || !filters.years.includes(y)) return false
      }
      if (filters.scopes.length) {
        const scopes = new Set((b.line_items ?? []).map((li) => li.scope))
        if (!filters.scopes.some((s) => scopes.has(s))) return false
      }
      if (filters.clients.length) {
        const names = new Set(bidClientNames(b))
        if (!filters.clients.some((c) => names.has(c))) return false
      }
      const value = b.total_price ?? 0
      if (min != null && value < min) return false
      if (max != null && value > max) return false
      if (filters.dueStart && b.bid_due_date < filters.dueStart) return false
      if (filters.dueEnd && b.bid_due_date > filters.dueEnd) return false
      return true
    })
  }, [bids, searchQuery, filters])

  const activeFilterCount =
    filters.branches.length +
    filters.years.length +
    filters.statuses.length +
    filters.estimatorIds.length +
    filters.clients.length +
    filters.scopes.length +
    (filters.minValue ? 1 : 0) +
    (filters.maxValue ? 1 : 0) +
    (filters.dueStart ? 1 : 0) +
    (filters.dueEnd ? 1 : 0)

  // Folder counts
  const branchCounts = useMemo(() => {
    const counts = new Map<Branch, number>()
    for (const b of filteredBids) counts.set(b.branch, (counts.get(b.branch) ?? 0) + 1)
    return counts
  }, [filteredBids])

  const yearCounts = useMemo(() => {
    if (!folderPath.branch) return new Map<number, number>()
    const counts = new Map<number, number>()
    for (const b of filteredBids) {
      if (b.branch !== folderPath.branch) continue
      const y = yearOf(b.bid_due_date)
      if (!y) continue
      counts.set(y, (counts.get(y) ?? 0) + 1)
    }
    return counts
  }, [filteredBids, folderPath.branch])

  const folderProjects = useMemo(() => {
    if (!folderPath.branch || !folderPath.year) return []
    return filteredBids
      .filter((b) => b.branch === folderPath.branch && yearOf(b.bid_due_date) === folderPath.year)
      .sort((a, b) => (a.bid_due_date < b.bid_due_date ? 1 : -1))
  }, [filteredBids, folderPath])

  // List view sorting (Project Name + Due Date only)
  const listBids = useMemo(() => {
    const arr = [...filteredBids]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.project_name.localeCompare(b.project_name)
      else cmp = (a.bid_due_date ?? '').localeCompare(b.bid_due_date ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filteredBids, sortKey, sortDir])

  function toggleSort(key: 'name' | 'due') {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'due' ? 'desc' : 'asc') }
  }

  function clearAllFilters() {
    setFilters(EMPTY_FILTERS)
  }

  function toggleArrayFilter<T>(key: keyof Filters, value: T) {
    setFilters((prev) => {
      const arr = (prev[key] as unknown as T[])
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...prev, [key]: next }
    })
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="shrink-0">
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2, marginBottom: 4 }}>
          Projects Library
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text3)', margin: 0 }}>
          Historical database of all bids — past, present, awarded, lost
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
        }}
      >
        {/* View toggle pill */}
        <div
          role="group"
          aria-label="View mode"
          style={{
            display: 'inline-flex',
            background: 'var(--surface2)',
            borderRadius: 999,
            padding: 2,
            border: '1px solid var(--border)',
          }}
        >
          <ViewToggleButton
            active={viewMode === 'folder'}
            onClick={() => changeView('folder')}
            icon={<FolderOpen size={13} />}
            label="Folder View"
          />
          <ViewToggleButton
            active={viewMode === 'list'}
            onClick={() => changeView('list')}
            icon={<ListIcon size={13} />}
            label="List View"
          />
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name…"
            style={{
              height: 32,
              width: '100%',
              padding: '0 10px 0 30px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.8rem',
            }}
          />
        </div>

        {/* Filter button */}
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: showFilters ? 'var(--surface2)' : 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <FilterIcon size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text3)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          style={{
            padding: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-sm)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <ChipGroup
            label="Branch"
            options={accessibleBranches.map((b) => ({ value: b, label: BRANCH_LABELS[b] }))}
            selected={filters.branches}
            onToggle={(v) => toggleArrayFilter('branches', v)}
          />
          <ChipGroup
            label="Year"
            options={allYears.map((y) => ({ value: y, label: String(y) }))}
            selected={filters.years}
            onToggle={(v) => toggleArrayFilter('years', v)}
          />
          <ChipGroup
            label="Status"
            options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
            selected={filters.statuses}
            onToggle={(v) => toggleArrayFilter('statuses', v)}
          />
          <ChipGroup
            label="Estimator"
            options={[
              ...estimatorOptions.map((p) => ({ value: p.id, label: p.name })),
              { value: '__unassigned__', label: 'Unassigned' },
            ]}
            selected={filters.estimatorIds}
            onToggle={(v) => toggleArrayFilter('estimatorIds', v)}
          />
          <ChipGroup
            label="Client"
            options={allClients.map((c) => ({ value: c, label: c }))}
            selected={filters.clients}
            onToggle={(v) => toggleArrayFilter('clients', v)}
          />
          <ChipGroup
            label="Scope"
            options={ALL_SCOPES.map((s) => ({ value: s, label: s }))}
            selected={filters.scopes}
            onToggle={(v) => toggleArrayFilter('scopes', v)}
          />
          <div>
            <FilterLabel>Bid Value</FilterLabel>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Min"
                value={filters.minValue}
                onChange={(e) => setFilters((f) => ({ ...f, minValue: e.target.value }))}
                style={numberInputStyle}
              />
              <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxValue}
                onChange={(e) => setFilters((f) => ({ ...f, maxValue: e.target.value }))}
                style={numberInputStyle}
              />
            </div>
          </div>
          <div>
            <FilterLabel>Due Date</FilterLabel>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={filters.dueStart}
                onChange={(e) => setFilters((f) => ({ ...f, dueStart: e.target.value }))}
                style={numberInputStyle}
              />
              <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>–</span>
              <input
                type="date"
                value={filters.dueEnd}
                onChange={(e) => setFilters((f) => ({ ...f, dueEnd: e.target.value }))}
                style={numberInputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div style={{ padding: 24, color: 'var(--text3)', fontSize: '0.85rem' }}>Loading…</div>
        ) : error ? (
          <div className="error-card">Error loading bids: {error}</div>
        ) : viewMode === 'folder' ? (
          <FolderView
            folderPath={folderPath}
            setFolderPath={setFolderPath}
            accessibleBranches={accessibleBranches}
            branchCounts={branchCounts}
            yearCounts={yearCounts}
            folderProjects={folderProjects}
          />
        ) : (
          <ListView
            bids={listBids}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
      </div>
    </div>
  )
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

const numberInputStyle: React.CSSProperties = {
  height: 30,
  flex: 1,
  minWidth: 0,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '0.78rem',
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  if (options.length === 0) {
    return (
      <div>
        <FilterLabel>{label}</FilterLabel>
        <p style={{ fontSize: '0.72rem', color: 'var(--text3)', fontStyle: 'italic' }}>No options</p>
      </div>
    )
  }
  return (
    <div>
      <FilterLabel>{label}</FilterLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value)
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onToggle(opt.value)}
              style={{
                fontSize: '0.7rem',
                padding: '3px 9px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: isSelected ? 'var(--accent)' : 'var(--surface)',
                color: isSelected ? 'white' : 'var(--text2)',
                cursor: 'pointer',
                fontWeight: isSelected ? 600 : 500,
                transition: 'all 120ms',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 26,
        padding: '0 12px',
        borderRadius: 999,
        border: 'none',
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text3)',
        fontSize: '0.75rem',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        transition: 'all 120ms',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Folder View ────────────────────────────────────────────────────────────

function FolderView({
  folderPath,
  setFolderPath,
  accessibleBranches,
  branchCounts,
  yearCounts,
  folderProjects,
}: {
  folderPath: { branch?: Branch; year?: number }
  setFolderPath: (p: { branch?: Branch; year?: number }) => void
  accessibleBranches: Branch[]
  branchCounts: Map<Branch, number>
  yearCounts: Map<number, number>
  folderProjects: Bid[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text3)' }}>
        <button
          type="button"
          onClick={() => setFolderPath({})}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: folderPath.branch ? 'var(--accent)' : 'var(--text)',
            fontWeight: folderPath.branch ? 500 : 700,
            cursor: 'pointer',
            fontSize: 'inherit',
          }}
        >
          All Branches
        </button>
        {folderPath.branch && (
          <>
            <ChevronRightIcon size={12} />
            <button
              type="button"
              onClick={() => setFolderPath({ branch: folderPath.branch })}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: folderPath.year ? 'var(--accent)' : 'var(--text)',
                fontWeight: folderPath.year ? 500 : 700,
                cursor: 'pointer',
                fontSize: 'inherit',
              }}
            >
              {folderPath.branch}
            </button>
          </>
        )}
        {folderPath.year && (
          <>
            <ChevronRightIcon size={12} />
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{folderPath.year}</span>
          </>
        )}
      </nav>

      {/* Level 1 — Branches */}
      {!folderPath.branch && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {accessibleBranches.map((b) => {
            const count = branchCounts.get(b) ?? 0
            return (
              <FolderCard
                key={b}
                title={b}
                subtitle={BRANCH_LABELS[b]}
                count={count}
                onClick={() => setFolderPath({ branch: b })}
              />
            )
          })}
        </div>
      )}

      {/* Level 2 — Years */}
      {folderPath.branch && !folderPath.year && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {[...yearCounts.entries()]
            .sort(([a], [b]) => b - a)
            .map(([year, count]) => (
              <FolderCard
                key={year}
                title={String(year)}
                count={count}
                onClick={() => setFolderPath({ branch: folderPath.branch, year })}
              />
            ))}
          {yearCounts.size === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No bids match the current filters.
            </p>
          )}
        </div>
      )}

      {/* Level 3 — Projects */}
      {folderPath.branch && folderPath.year && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) 110px minmax(0, 1fr) minmax(0, 1.2fr) 110px',
              gap: 12,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span>Project</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Bid Value</span>
            <span>Estimator / Client</span>
            <span style={{ textAlign: 'right' }}>Due</span>
          </div>
          {folderProjects.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No projects in {folderPath.branch} for {folderPath.year}.
            </div>
          ) : (
            folderProjects.map((bid) => (
              <FolderProjectRow key={bid.id} bid={bid} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FolderCard({
  title,
  subtitle,
  count,
  onClick,
}: {
  title: string
  subtitle?: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 14,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'all 150ms',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget as HTMLElement
        t.style.borderColor = 'var(--accent)'
        t.style.boxShadow = 'var(--shadow)'
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget as HTMLElement
        t.style.borderColor = 'var(--border)'
        t.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <FolderOpen size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text3)', margin: '2px 0 0' }}>{subtitle}</p>
        )}
        <p style={{ fontSize: '0.72rem', color: 'var(--text3)', margin: '6px 0 0' }}>
          {count} bid{count === 1 ? '' : 's'}
        </p>
      </div>
    </button>
  )
}

function FolderProjectRow({ bid }: { bid: Bid }) {
  const clientNames = bidClientNames(bid)
  const value = bid.total_price ?? 0
  return (
    <Link
      href={`/dashboard/bids/${bid.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) 110px minmax(0, 1fr) minmax(0, 1.2fr) 110px',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
        alignItems: 'center',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {bid.project_name}
      </span>
      <span
        className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 border text-xs font-medium w-fit ${STATUS_BADGE_CLASSES[bid.status]}`}
      >
        {bid.status}
      </span>
      <span style={{
        textAlign: 'right',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
      }}>
        {value > 0 ? formatCurrency(value) : '—'}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {bid.estimator_name ?? 'Unassigned'}
        {clientNames.length > 0 && (
          <span style={{ color: 'var(--text3)' }}> · {clientNames.join(', ')}</span>
        )}
      </span>
      <span style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text2)' }}>
        {formatDate(bid.bid_due_date)}
      </span>
    </Link>
  )
}

// ─── List View ──────────────────────────────────────────────────────────────

function ListView({
  bids,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  bids: Bid[]
  sortKey: 'name' | 'due'
  sortDir: 'asc' | 'desc'
  onToggleSort: (key: 'name' | 'due') => void
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 160px',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}
      >
        <SortHeader label="Project Name" active={sortKey === 'name'} dir={sortDir} onClick={() => onToggleSort('name')} align="left" />
        <SortHeader label="Due Date" active={sortKey === 'due'} dir={sortDir} onClick={() => onToggleSort('due')} align="right" />
      </div>
      {bids.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem', fontStyle: 'italic' }}>
          No projects match the current filters.
        </div>
      ) : (
        bids.map((bid) => (
          <Link
            key={bid.id}
            href={`/dashboard/bids/${bid.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 160px',
              gap: 12,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'inherit',
              alignItems: 'center',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bid.project_name}
            </span>
            <span style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text2)' }}>
              {formatDate(bid.bid_due_date)}
            </span>
          </Link>
        ))
      )}
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 4,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: active ? 'var(--text)' : 'var(--text3)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}
      {active && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  )
}
