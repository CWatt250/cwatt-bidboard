'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ArrowUp, ArrowDown, Printer, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { useUserRole } from '@/contexts/userRole'
import {
  useReports,
  DEFAULT_FILTERS,
  type ReportFilters,
  type ByBranchRow,
  type ByEstimatorRow,
  type ByScopeRow,
  type ByMonthRow,
} from '@/hooks/useReports'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import type { Branch, BidScope, BidStatus } from '@/lib/supabase/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const ALL_SCOPES: BidScope[] = [
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other',
]
const ALL_STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline size-3 opacity-40" />
  if (dir === 'asc') return <ArrowUp className="ml-1 inline size-3" />
  return <ArrowDown className="ml-1 inline size-3" />
}

function useSortState<K extends string>(defaultKey: K, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<K>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggle(key: K) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortRows<T>(rows: T[], accessor: (r: T) => string | number): T[] {
    return [...rows].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  return { sortKey, sortDir, toggle, sortRows }
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <p className="mt-1 text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Filter count ─────────────────────────────────────────────────────────────

function countActiveFilters(f: ReportFilters): number {
  let n = 0
  if (f.dateRange.from || f.dateRange.to) n++
  if (f.branches.length > 0) n++
  if (f.estimators.length > 0) n++
  if (f.scopes.length > 0) n++
  if (f.statuses.length > 0) n++
  return n
}

function filterSummaryText(f: ReportFilters): string {
  const parts: string[] = []
  if (f.dateRange.from && f.dateRange.to)
    parts.push(`Date: ${f.dateRange.from} to ${f.dateRange.to}`)
  else if (f.dateRange.from) parts.push(`From: ${f.dateRange.from}`)
  else if (f.dateRange.to) parts.push(`To: ${f.dateRange.to}`)
  if (f.branches.length > 0) parts.push(`Branches: ${f.branches.join(', ')}`)
  if (f.estimators.length > 0) parts.push(`Estimators filtered`)
  if (f.scopes.length > 0) parts.push(`Scopes: ${f.scopes.join(', ')}`)
  if (f.statuses.length > 0) parts.push(`Statuses: ${f.statuses.join(', ')}`)
  return parts.length > 0 ? parts.join(' · ') : 'All data (no filters applied)'
}

// ─── Checkbox group ───────────────────────────────────────────────────────────

function CheckGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (vals: T[]) => void
}) {
  function toggle(val: T) {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-3">
        {options.map(({ value, label: optLabel }) => (
          <label key={value} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => toggle(value)}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-xs">{optLabel}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Totals row ───────────────────────────────────────────────────────────────

function TotalsRow({ cells }: { cells: React.ReactNode[] }) {
  return (
    <TableRow className="border-t-2 font-semibold bg-muted/40">
      {cells.map((cell, i) => (
        <TableCell key={i}>{cell}</TableCell>
      ))}
    </TableRow>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isEstimator, isAdmin, isBranchManager, branches: userBranches, loading: roleLoading } =
    useUserRole()
  const router = useRouter()

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<ReportFilters>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(DEFAULT_FILTERS)

  const { metrics, filteredBids, allEstimators, loading, error } = useReports(appliedFilters)

  // Access control — estimators are redirected
  useEffect(() => {
    if (!roleLoading && isEstimator) {
      router.replace('/dashboard')
    }
  }, [roleLoading, isEstimator, router])

  if (roleLoading || isEstimator) return null

  const activeFilterCount = countActiveFilters(appliedFilters)

  const filterBranchOptions = (isAdmin ? ALL_BRANCHES : userBranches).map((b) => ({
    value: b,
    label: BRANCH_LABELS[b],
  }))

  const filterEstimatorOptions = allEstimators
    .filter(
      (e) =>
        pendingFilters.branches.length === 0 ||
        (e.branch !== '' && pendingFilters.branches.includes(e.branch as Branch))
    )
    .map((e) => ({ value: e.id, label: e.name }))

  function applyFilters() {
    setAppliedFilters({ ...pendingFilters })
    setFiltersOpen(false)
  }

  function resetFilters() {
    setPendingFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      'Project Name',
      'Branch',
      'Estimator',
      'Status',
      'Bid Due Date',
      'Created At',
      'Total Value',
    ]
    const rows = filteredBids.map((b) => [
      b.project_name,
      b.branch,
      b.estimator_name ?? '',
      b.status,
      b.bid_due_date,
      b.created_at.slice(0, 10),
      b.total_price ?? 0,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const today = new Date().toISOString().slice(0, 10)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bidwatt-report-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Sort state ──────────────────────────────────────────────────────────────
  const branchSort = useSortState<keyof ByBranchRow>('pipeline')
  const estimatorSort = useSortState<keyof ByEstimatorRow>('pipeline')
  const scopeSort = useSortState<keyof ByScopeRow>('totalValue')
  const monthSort = useSortState<keyof ByMonthRow>('month', 'asc')

  const sortedBranch = useMemo(() => {
    if (!metrics) return []
    return branchSort.sortRows(metrics.byBranch, (r) => r[branchSort.sortKey] as number)
  }, [metrics, branchSort.sortKey, branchSort.sortDir])

  const sortedEstimator = useMemo(() => {
    if (!metrics) return []
    return estimatorSort.sortRows(metrics.byEstimator, (r) => {
      const v = r[estimatorSort.sortKey]
      return typeof v === 'string' ? v : (v as number)
    })
  }, [metrics, estimatorSort.sortKey, estimatorSort.sortDir])

  const sortedScope = useMemo(() => {
    if (!metrics) return []
    return scopeSort.sortRows(metrics.byScope, (r) => r[scopeSort.sortKey] as number)
  }, [metrics, scopeSort.sortKey, scopeSort.sortDir])

  const sortedMonth = useMemo(() => {
    if (!metrics) return []
    return monthSort.sortRows(metrics.byMonth, (r) => r[monthSort.sortKey] as string | number)
  }, [metrics, monthSort.sortKey, monthSort.sortDir])

  // ── Totals ──────────────────────────────────────────────────────────────────
  const branchTotals = useMemo(() => {
    if (!metrics) return null
    const rows = metrics.byBranch
    const awarded = rows.reduce((s, r) => s + r.awarded, 0)
    const lost = rows.reduce((s, r) => s + r.lost, 0)
    const total = awarded + lost
    return {
      totalBids: rows.reduce((s, r) => s + r.totalBids, 0),
      pipeline: rows.reduce((s, r) => s + r.pipeline, 0),
      sent: rows.reduce((s, r) => s + r.sent, 0),
      awarded,
      lost,
      winRate: total === 0 ? 0 : Math.round((awarded / total) * 1000) / 10,
    }
  }, [metrics])

  const estimatorTotals = useMemo(() => {
    if (!metrics) return null
    const rows = metrics.byEstimator
    const awarded = rows.reduce((s, r) => s + r.awarded, 0)
    const lost = rows.reduce((s, r) => s + r.lost, 0)
    const total = awarded + lost
    return {
      totalBids: rows.reduce((s, r) => s + r.totalBids, 0),
      pipeline: rows.reduce((s, r) => s + r.pipeline, 0),
      sent: rows.reduce((s, r) => s + r.sent, 0),
      awarded,
      lost,
      winRate: total === 0 ? 0 : Math.round((awarded / total) * 1000) / 10,
    }
  }, [metrics])

  const pipelineTotal = metrics?.byScope.reduce((s, r) => s + r.totalValue, 0) ?? 0

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          aside { display: none !important; }
          header.fixed { display: none !important; }
          main { margin-left: 0 !important; padding-top: 0 !important; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          .print-section { page-break-inside: avoid; }
          body { color: #000 !important; background: #fff !important; }
          * { border-color: #ccc !important; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* ── Print-only header ── */}
      <div className="print-header hidden mb-6">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <p className="text-xl font-bold">BidWatt · Irex Argus</p>
            <p className="text-lg font-semibold mt-0.5">BidWatt Report</p>
          </div>
          <div className="text-right text-sm">
            <p>Generated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
            <p className="mt-0.5">Filters: {filterSummaryText(appliedFilters)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Reports</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading
                ? 'Loading…'
                : `${filteredBids.length} bid${filteredBids.length !== 1 ? 's' : ''}${activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4 mr-2" />
              Print Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={loading || filteredBids.length === 0}
            >
              <Download className="size-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* ── Filter panel ── */}
        <div className="rounded-lg border no-print">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="flex items-center gap-2">
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {activeFilterCount}
                </Badge>
              )}
            </span>
            {filtersOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {filtersOpen && (
            <div className="border-t px-4 py-4 space-y-5">
              {/* Date range */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Date Range (Created At)
                </p>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <input
                      type="date"
                      value={pendingFilters.dateRange.from ?? ''}
                      onChange={(e) =>
                        setPendingFilters((f) => ({
                          ...f,
                          dateRange: { ...f.dateRange, from: e.target.value || null },
                        }))
                      }
                      className="h-8 rounded-md border px-2 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <input
                      type="date"
                      value={pendingFilters.dateRange.to ?? ''}
                      onChange={(e) =>
                        setPendingFilters((f) => ({
                          ...f,
                          dateRange: { ...f.dateRange, to: e.target.value || null },
                        }))
                      }
                      className="h-8 rounded-md border px-2 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              <CheckGroup
                label="Branches"
                options={filterBranchOptions}
                selected={pendingFilters.branches}
                onChange={(vals) => setPendingFilters((f) => ({ ...f, branches: vals }))}
              />

              {filterEstimatorOptions.length > 0 && (
                <CheckGroup
                  label="Estimators"
                  options={filterEstimatorOptions}
                  selected={pendingFilters.estimators}
                  onChange={(vals) => setPendingFilters((f) => ({ ...f, estimators: vals }))}
                />
              )}

              <CheckGroup
                label="Scopes"
                options={ALL_SCOPES.map((s) => ({ value: s, label: s }))}
                selected={pendingFilters.scopes}
                onChange={(vals) => setPendingFilters((f) => ({ ...f, scopes: vals }))}
              />

              <CheckGroup
                label="Statuses"
                options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
                selected={pendingFilters.statuses}
                onChange={(vals) => setPendingFilters((f) => ({ ...f, statuses: vals }))}
              />

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">Error loading reports: {error}</p>}

        {/* ══════════════════════════════════════════════════════════════
            Section 1 — Metric Cards
        ══════════════════════════════════════════════════════════════ */}
        <section className="print-section">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Summary
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label="Total Pipeline Value"
              value={metrics ? fmtCurrency(metrics.totalPipeline) : '—'}
              loading={loading}
            />
            <MetricCard
              label="Total Bids"
              value={metrics ? String(metrics.totalBids) : '—'}
              loading={loading}
            />
            <MetricCard
              label="Win Rate"
              value={metrics ? fmtPct(metrics.winRate) : '—'}
              loading={loading}
            />
            <MetricCard
              label="Awarded YTD"
              value={metrics ? String(metrics.awardedCount) : '—'}
              loading={loading}
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            Section 2 — Performance by Branch
        ══════════════════════════════════════════════════════════════ */}
        <section className="print-section space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Performance by Branch
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      ['branch', 'Branch'],
                      ['totalBids', 'Total Bids'],
                      ['pipeline', 'Pipeline Value'],
                      ['sent', 'Sent'],
                      ['awarded', 'Awarded'],
                      ['lost', 'Lost'],
                      ['winRate', 'Win Rate'],
                    ] as [keyof ByBranchRow, string][]
                  ).map(([key, label]) => (
                    <TableHead key={key}>
                      <button
                        className="flex items-center font-medium"
                        onClick={() => branchSort.toggle(key)}
                      >
                        {label}
                        <SortIcon active={branchSort.sortKey === key} dir={branchSort.sortDir} />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <>
                    {sortedBranch.map((row) => (
                      <TableRow key={row.branch}>
                        <TableCell className="font-medium">{BRANCH_LABELS[row.branch]}</TableCell>
                        <TableCell>{row.totalBids}</TableCell>
                        <TableCell>{fmtCurrency(row.pipeline)}</TableCell>
                        <TableCell>{row.sent}</TableCell>
                        <TableCell>{row.awarded}</TableCell>
                        <TableCell>{row.lost}</TableCell>
                        <TableCell>{fmtPct(row.winRate)}</TableCell>
                      </TableRow>
                    ))}
                    {branchTotals && (
                      <TotalsRow
                        cells={[
                          'Totals',
                          branchTotals.totalBids,
                          fmtCurrency(branchTotals.pipeline),
                          branchTotals.sent,
                          branchTotals.awarded,
                          branchTotals.lost,
                          fmtPct(branchTotals.winRate),
                        ]}
                      />
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            Section 3 — Performance by Estimator
        ══════════════════════════════════════════════════════════════ */}
        <section className="print-section space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Performance by Estimator
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      ['name', 'Estimator'],
                      ['branch', 'Branch'],
                      ['totalBids', 'Total Bids'],
                      ['pipeline', 'Pipeline Value'],
                      ['sent', 'Sent'],
                      ['awarded', 'Awarded'],
                      ['lost', 'Lost'],
                      ['winRate', 'Win Rate'],
                    ] as [keyof ByEstimatorRow, string][]
                  ).map(([key, label]) => (
                    <TableHead key={key}>
                      <button
                        className="flex items-center font-medium"
                        onClick={() => estimatorSort.toggle(key)}
                      >
                        {label}
                        <SortIcon
                          active={estimatorSort.sortKey === key}
                          dir={estimatorSort.sortDir}
                        />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sortedEstimator.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No estimator data for current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {sortedEstimator.map((row) => (
                      <TableRow key={row.estimatorId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.branch || '—'}</TableCell>
                        <TableCell>{row.totalBids}</TableCell>
                        <TableCell>{fmtCurrency(row.pipeline)}</TableCell>
                        <TableCell>{row.sent}</TableCell>
                        <TableCell>{row.awarded}</TableCell>
                        <TableCell>{row.lost}</TableCell>
                        <TableCell>{fmtPct(row.winRate)}</TableCell>
                      </TableRow>
                    ))}
                    {estimatorTotals && (
                      <TotalsRow
                        cells={[
                          'Totals',
                          '—',
                          estimatorTotals.totalBids,
                          fmtCurrency(estimatorTotals.pipeline),
                          estimatorTotals.sent,
                          estimatorTotals.awarded,
                          estimatorTotals.lost,
                          fmtPct(estimatorTotals.winRate),
                        ]}
                      />
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            Section 4 — Scope Distribution
        ══════════════════════════════════════════════════════════════ */}
        <section className="print-section space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Scope Distribution
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      ['scope', 'Scope'],
                      ['count', 'Bid Count'],
                      ['totalValue', 'Total Value'],
                    ] as [keyof ByScopeRow, string][]
                  ).map(([key, label]) => (
                    <TableHead key={key}>
                      <button
                        className="flex items-center font-medium"
                        onClick={() => scopeSort.toggle(key)}
                      >
                        {label}
                        <SortIcon active={scopeSort.sortKey === key} dir={scopeSort.sortDir} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>% of Pipeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <>
                    {sortedScope.map((row) => (
                      <TableRow key={row.scope}>
                        <TableCell className="font-medium">{row.scope}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>{fmtCurrency(row.totalValue)}</TableCell>
                        <TableCell>
                          {pipelineTotal > 0
                            ? fmtPct((row.totalValue / pipelineTotal) * 100)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TotalsRow
                      cells={[
                        'Totals',
                        metrics?.byScope.reduce((s, r) => s + r.count, 0) ?? 0,
                        fmtCurrency(pipelineTotal),
                        pipelineTotal > 0 ? '100.0%' : '—',
                      ]}
                    />
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            Section 5 — Monthly Activity
        ══════════════════════════════════════════════════════════════ */}
        <section className="print-section space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Monthly Activity (Last 6 Months)
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      ['month', 'Month'],
                      ['created', 'Bids Created'],
                      ['sent', 'Bids Sent'],
                      ['awarded', 'Awarded'],
                    ] as [keyof ByMonthRow, string][]
                  ).map(([key, label]) => (
                    <TableHead key={key}>
                      <button
                        className="flex items-center font-medium"
                        onClick={() => monthSort.toggle(key)}
                      >
                        {label}
                        <SortIcon active={monthSort.sortKey === key} dir={monthSort.sortDir} />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  sortedMonth.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell>{row.created}</TableCell>
                      <TableCell>{row.sent}</TableCell>
                      <TableCell>{row.awarded}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  )
}
