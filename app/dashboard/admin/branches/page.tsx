'use client'

import { useState, useEffect } from 'react'
import { MapPin, Users, FileText, Pencil, Check, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useBranchStats, useUsersByBranch } from '@/hooks/useBranchStats'
import type { Branch } from '@/lib/supabase/types'

interface BranchRecord {
  code: Branch
  name: string
  location: string
  id: string
}

const DEFAULT_BRANCHES: BranchRecord[] = [
  { code: 'PSC', name: 'Pasco',          location: 'Pasco, WA',          id: '#467' },
  { code: 'SEA', name: 'Seattle',        location: 'Seattle, WA',        id: '#466' },
  { code: 'POR', name: 'Portland',       location: 'Portland, OR',       id: '#465' },
  { code: 'PHX', name: 'Phoenix',        location: 'Phoenix, AZ',        id: '#462' },
  { code: 'SLC', name: 'Salt Lake City', location: 'Salt Lake City, UT', id: '#468' },
]

const STORAGE_KEY = 'bidwatt:branch_overrides'

type BranchOverride = { name: string; location: string }

function loadOverrides(): Record<Branch, BranchOverride> {
  if (typeof window === 'undefined') return {} as Record<Branch, BranchOverride>
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : ({} as Record<Branch, BranchOverride>)
  } catch {
    return {} as Record<Branch, BranchOverride>
  }
}

function saveOverrides(o: Record<Branch, BranchOverride>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o))
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  branch_manager: 'Branch Manager',
  estimator: 'Estimator',
}

export default function BranchesPage() {
  const { stats, loading: statsLoading } = useBranchStats()
  const [overrides, setOverrides] = useState<Record<Branch, BranchOverride>>(
    {} as Record<Branch, BranchOverride>
  )
  const [editingCode, setEditingCode] = useState<Branch | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null)

  useEffect(() => {
    setOverrides(loadOverrides())
  }, [])

  const branches: BranchRecord[] = DEFAULT_BRANCHES.map((b) => {
    const ov = overrides[b.code]
    return ov ? { ...b, name: ov.name, location: ov.location } : b
  })

  function startEdit(branch: BranchRecord) {
    setEditingCode(branch.code)
    setEditName(branch.name)
    setEditLocation(branch.location)
  }

  function cancelEdit() {
    setEditingCode(null)
    setEditName('')
    setEditLocation('')
  }

  function saveEdit() {
    if (!editingCode) return
    const next = { ...overrides, [editingCode]: { name: editName, location: editLocation } }
    setOverrides(next)
    saveOverrides(next)
    cancelEdit()
  }

  const { users: drawerUsers, loading: usersLoading } = useUsersByBranch(viewingBranch)
  const viewedBranch = branches.find((b) => b.code === viewingBranch)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Branch Management
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Five fixed branches — edit display names and locations here.
        </p>
      </div>

      {/* Branch cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const branchStats = stats[branch.code]
          const isEditing = editingCode === branch.code

          return (
            <div
              key={branch.code}
              className="flex flex-col gap-3 rounded-xl p-4 transition-all"
              style={{
                background: 'var(--card)',
                border: '0.5px solid var(--border)',
              }}
            >
              {/* Branch code + ID */}
              <div className="flex items-start justify-between">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {branch.code}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {branch.id}
                  </span>
                </div>

                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => startEdit(branch)}
                    title="Edit branch"
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
              </div>

              {/* Name + location (inline edit) */}
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Branch name"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Location"
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="xs" onClick={saveEdit} disabled={!editName || !editLocation}>
                      <Check className="size-3" />
                      Save
                    </Button>
                    <Button size="xs" variant="outline" onClick={cancelEdit}>
                      <X className="size-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {branch.name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {branch.location}
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div
                className="flex items-center gap-4 pt-2"
                style={{ borderTop: '0.5px solid var(--border)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-blue-500" />
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {statsLoading ? (
                      <Skeleton className="inline-block h-3 w-5" />
                    ) : (
                      branchStats?.activeUsers ?? 0
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">users</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-emerald-500" />
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {statsLoading ? (
                      <Skeleton className="inline-block h-3 w-5" />
                    ) : (
                      branchStats?.activeBids ?? 0
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">active bids</span>
                </div>
              </div>

              {/* Actions */}
              {!isEditing && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setViewingBranch(branch.code)}
                  className="w-full"
                >
                  <Eye className="size-3" />
                  View Users
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Users drawer */}
      <Sheet open={viewingBranch !== null} onOpenChange={(open) => { if (!open) setViewingBranch(null) }}>
        <SheetContent className="w-[380px] max-w-full flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {viewedBranch ? `${viewedBranch.code} — ${viewedBranch.name}` : 'Users'}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-4">
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : drawerUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No active users assigned to this branch.
              </p>
            ) : (
              <div className="space-y-1.5">
                {drawerUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ border: '0.5px solid var(--border)', background: 'var(--card)' }}
                  >
                    <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                      {u.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
