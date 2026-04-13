'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MODULES, ACTION_COLUMNS, ACTION_LABELS } from './types'
import type { Role, RolePermission } from './types'

interface PermissionMatrixProps {
  role: Role | null
  rolePermissions: RolePermission[]
  loading: boolean
  onSave: (permissions: Array<{ permission_key: string; allowed: boolean }>) => Promise<void>
}

export function PermissionMatrix({
  role,
  rolePermissions,
  loading,
  onSave,
}: PermissionMatrixProps) {
  // Local state for the matrix checkboxes
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // Initialize local perms from rolePermissions
  useEffect(() => {
    const map: Record<string, boolean> = {}
    for (const rp of rolePermissions) {
      map[rp.permission_key] = rp.allowed
    }
    setLocalPerms(map)
  }, [rolePermissions])

  // Track unsaved changes
  const hasChanges = useMemo(() => {
    const original: Record<string, boolean> = {}
    for (const rp of rolePermissions) {
      original[rp.permission_key] = rp.allowed
    }
    for (const mod of MODULES) {
      for (const action of mod.actions) {
        const key = `${mod.key}.${action}`
        const origVal = original[key] ?? false
        const localVal = localPerms[key] ?? false
        if (origVal !== localVal) return true
      }
    }
    return false
  }, [localPerms, rolePermissions])

  function togglePermission(key: string) {
    setLocalPerms((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    if (!role) return
    setSaving(true)
    const permissions: Array<{ permission_key: string; allowed: boolean }> = []
    for (const [key, allowed] of Object.entries(localPerms)) {
      if (allowed) permissions.push({ permission_key: key, allowed })
    }
    await onSave(permissions)
    setSaving(false)
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Select a role to view its permissions
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {role.name} — Permissions
          </h3>
          <p className="text-xs text-muted-foreground">{role.description}</p>
        </div>
        <Button
          size="sm"
          disabled={!hasChanges || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Unsaved indicator */}
      {hasChanges && (
        <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
          style={{ border: '1px solid rgba(217, 119, 6, 0.2)' }}
        >
          You have unsaved changes
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: '0.5px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--muted)', borderBottom: '0.5px solid var(--border)' }}>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground" style={{ width: 160 }}>
                Module
              </th>
              {ACTION_COLUMNS.map((col) => (
                <th key={col} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground" style={{ width: 80 }}>
                  {ACTION_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod, idx) => (
              <tr
                key={mod.key}
                style={{
                  borderBottom: idx < MODULES.length - 1 ? '0.5px solid var(--border)' : undefined,
                }}
              >
                <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {mod.label}
                </td>
                {ACTION_COLUMNS.map((action) => {
                  const permKey = `${mod.key}.${action}`
                  const applicable = mod.actions.includes(action)
                  const checked = localPerms[permKey] ?? false

                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      {applicable ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(permKey)}
                          className="size-3.5 cursor-pointer accent-blue-500"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
