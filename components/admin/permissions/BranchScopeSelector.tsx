'use client'

import { Badge } from '@/components/ui/badge'

const BRANCHES = [
  { code: 'PSC', label: 'Pasco' },
  { code: 'SEA', label: 'Seattle' },
  { code: 'POR', label: 'Portland' },
  { code: 'PHX', label: 'Phoenix' },
  { code: 'SLC', label: 'Salt Lake City' },
]

interface BranchScopeSelectorProps {
  allBranches: boolean
  selectedBranch: string | null
  onToggleAll: () => void
  onSelectBranch: (code: string) => void
}

export function BranchScopeSelector({
  allBranches,
  selectedBranch,
  onToggleAll,
  onSelectBranch,
}: BranchScopeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Scope:</span>
      <button
        onClick={onToggleAll}
        className="cursor-pointer"
      >
        <Badge variant={allBranches ? 'default' : 'outline'} className="text-xs">
          All Branches
        </Badge>
      </button>
      {!allBranches &&
        BRANCHES.map((b) => (
          <button
            key={b.code}
            onClick={() => onSelectBranch(b.code)}
            className="cursor-pointer"
          >
            <Badge
              variant={selectedBranch === b.code ? 'default' : 'outline'}
              className="text-xs"
            >
              {b.code}
            </Badge>
          </button>
        ))}
    </div>
  )
}
