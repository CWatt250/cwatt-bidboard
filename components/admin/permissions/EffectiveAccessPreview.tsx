'use client'

import { Check, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { MODULES, ACTION_LABELS } from './types'

interface EffectiveAccessPreviewProps {
  access: Record<string, boolean>
  loading: boolean
}

export function EffectiveAccessPreview({ access, loading }: EffectiveAccessPreviewProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-48" />
        ))}
      </div>
    )
  }

  const keys = Object.keys(access)
  if (keys.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a user to view their effective access.
      </p>
    )
  }

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--muted)', border: '0.5px solid var(--border)' }}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Effective Access
      </p>
      <div className="space-y-1">
        {MODULES.map((mod) => {
          const modulePerms = mod.actions.map((action) => ({
            key: `${mod.key}.${action}`,
            label: `${ACTION_LABELS[action]}`,
            allowed: access[`${mod.key}.${action}`] ?? false,
          }))

          const anyAllowed = modulePerms.some((p) => p.allowed)
          if (!anyAllowed && modulePerms.every((p) => !p.allowed)) {
            return (
              <div key={mod.key} className="flex items-center gap-2 py-0.5">
                <X className="size-3 text-red-400" />
                <span className="text-xs text-muted-foreground">{mod.label}: No access</span>
              </div>
            )
          }

          return (
            <div key={mod.key} className="py-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Check className="size-3 text-emerald-500" />
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {mod.label}:
                </span>
                {modulePerms
                  .filter((p) => p.allowed)
                  .map((p) => (
                    <span
                      key={p.key}
                      className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                    >
                      {p.label}
                    </span>
                  ))}
                {modulePerms
                  .filter((p) => !p.allowed)
                  .map((p) => (
                    <span
                      key={p.key}
                      className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-400 line-through"
                    >
                      {p.label}
                    </span>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
