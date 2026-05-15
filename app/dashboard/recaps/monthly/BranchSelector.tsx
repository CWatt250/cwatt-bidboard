'use client'

import type { Branch } from '@/lib/supabase/types'

interface BranchSelectorProps {
  selected: Branch[]
  onChange: (branches: Branch[]) => void
}

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

const BRANCH_PILL: Record<Branch, { active: string; inactive: string; label: string }> = {
  PSC: { active: 'bg-sky-100 text-sky-700 border-sky-300', inactive: 'bg-white text-gray-400 border-gray-200', label: 'PSC' },
  SEA: { active: 'bg-teal-100 text-teal-700 border-teal-300', inactive: 'bg-white text-gray-400 border-gray-200', label: 'SEA' },
  POR: { active: 'bg-violet-100 text-violet-700 border-violet-300', inactive: 'bg-white text-gray-400 border-gray-200', label: 'POR' },
  PHX: { active: 'bg-orange-100 text-orange-700 border-orange-300', inactive: 'bg-white text-gray-400 border-gray-200', label: 'PHX' },
  SLC: { active: 'bg-lime-100 text-lime-700 border-lime-300', inactive: 'bg-white text-gray-400 border-gray-200', label: 'SLC' },
}

export function BranchSelector({ selected, onChange }: BranchSelectorProps) {
  const allSelected = selected.length === ALL_BRANCHES.length

  function toggle(branch: Branch) {
    if (selected.includes(branch)) {
      onChange(selected.filter((b) => b !== branch))
    } else {
      onChange([...selected, branch])
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        Branches
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ALL_BRANCHES.map((branch) => {
          const isActive = selected.includes(branch)
          const colors = BRANCH_PILL[branch]
          return (
            <button
              key={branch}
              type="button"
              onClick={() => toggle(branch)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 9999,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                lineHeight: 1.4,
              }}
              className={isActive ? colors.active : colors.inactive}
            >
              {colors.label}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : [...ALL_BRANCHES])}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--accent)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {allSelected ? 'Clear' : 'Select all'}
      </button>
    </div>
  )
}
