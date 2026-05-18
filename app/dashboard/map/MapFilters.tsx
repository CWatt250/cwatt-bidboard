'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRANCH_BADGE_CLASSES } from '@/config/colors'
import type { Branch } from '@/lib/supabase/types'
import type { MapBid } from './MapPageClient'

export type StatusFilter = 'both' | 'awarded' | 'verbal'

/** The five Irex branches that get a filter pill, in display order. */
export const MAP_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

/** Sentinel <Select> value for the "no estimator filter" option. */
const ALL_ESTIMATORS = '__all_estimators__'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'verbal', label: 'Verbal' },
]

interface MapFiltersProps {
  /** All loaded bids — used to derive the estimator dropdown options. */
  bids: MapBid[]
  statusFilter: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  selectedBranches: Branch[]
  onBranchToggle: (b: Branch) => void
  selectedEstimator: string | null
  onEstimatorChange: (e: string | null) => void
  isAdmin: boolean
}

export function MapFilters({
  bids,
  statusFilter,
  onStatusChange,
  selectedBranches,
  onBranchToggle,
  selectedEstimator,
  onEstimatorChange,
  isAdmin,
}: MapFiltersProps) {
  const estimatorNames = Array.from(
    new Set(bids.map((b) => b.estimator_name).filter((n): n is string => !!n)),
  ).sort((a, b) => a.localeCompare(b))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        marginBottom: 12,
        borderBottom: '0.5px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      {/* Filter 1 — Status segmented control */}
      <div
        role="group"
        aria-label="Filter by status"
        style={{
          display: 'inline-flex',
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          padding: 2,
          gap: 2,
        }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(opt.value)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 6,
                border: active ? '0.5px solid var(--border)' : '0.5px solid transparent',
                background: active ? 'var(--surface2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text3)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                lineHeight: 1.5,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Filter 2 — Branch pills */}
      <div
        role="group"
        aria-label="Filter by branch"
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      >
        {MAP_BRANCHES.map((branch) => {
          const active = selectedBranches.includes(branch)
          return (
            <button
              key={branch}
              type="button"
              aria-pressed={active}
              onClick={() => onBranchToggle(branch)}
              className={
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ' +
                (active
                  ? BRANCH_BADGE_CLASSES[branch]
                  : 'bg-muted text-muted-foreground border-transparent')
              }
            >
              {branch}
            </button>
          )
        })}
      </div>

      {/* Filter 3 — Estimator dropdown (admin only) */}
      {isAdmin && (
        <Select
          value={selectedEstimator ?? ALL_ESTIMATORS}
          onValueChange={(v) =>
            onEstimatorChange(v && v !== ALL_ESTIMATORS ? String(v) : null)
          }
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by estimator">
            <SelectValue placeholder="All estimators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ESTIMATORS}>All estimators</SelectItem>
            {estimatorNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
