'use client'

import { useState } from 'react'
import { Trash2, Plus, Search } from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EffectiveAccessPreview } from './EffectiveAccessPreview'
import { MODULES } from './types'
import type { UserOverride } from './types'

interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  branches: string[]
}

interface UserOverridesPanelProps {
  users: UserInfo[]
  selectedUser: UserInfo | null
  onSelectUser: (user: UserInfo) => void
  overrides: UserOverride[]
  overridesLoading: boolean
  onAddOverride: (override: {
    user_id: string
    permission_key: string
    allowed: boolean
    branch_id?: string | null
    reason: string
  }) => Promise<void>
  onRemoveOverride: (overrideId: string, userId: string) => Promise<void>
  effectiveAccess: Record<string, boolean>
  effectiveAccessLoading: boolean
}

// Collect all permission keys for the override selector
const ALL_PERMISSION_KEYS = MODULES.flatMap((mod) =>
  mod.actions.map((action) => `${mod.key}.${action}`)
)

const BRANCHES = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

export function UserOverridesPanel({
  users,
  selectedUser,
  onSelectUser,
  overrides,
  overridesLoading,
  onAddOverride,
  onRemoveOverride,
  effectiveAccess,
  effectiveAccessLoading,
}: UserOverridesPanelProps) {
  const [userSearch, setUserSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPermKey, setNewPermKey] = useState('')
  const [newAllowed, setNewAllowed] = useState<'allow' | 'deny'>('deny')
  const [newBranch, setNewBranch] = useState<string>('all')
  const [newReason, setNewReason] = useState('')
  const [addingOverride, setAddingOverride] = useState(false)

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  async function handleAddOverride() {
    if (!selectedUser || !newPermKey || !newReason) return
    setAddingOverride(true)
    await onAddOverride({
      user_id: selectedUser.id,
      permission_key: newPermKey,
      allowed: newAllowed === 'allow',
      branch_id: newBranch === 'all' ? null : newBranch,
      reason: newReason,
    })
    setShowAddForm(false)
    setNewPermKey('')
    setNewAllowed('deny')
    setNewBranch('all')
    setNewReason('')
    setAddingOverride(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* User search */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Search User
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        {userSearch && (
          <div
            className="mt-1 max-h-48 overflow-y-auto rounded-lg"
            style={{ border: '0.5px solid var(--border)', background: 'var(--card)' }}
          >
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No users found</p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSelectUser(u)
                    setUserSearch('')
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected user info */}
      {selectedUser && (
        <div className="rounded-lg p-3" style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {selectedUser.name}
              </p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
            <Badge variant="secondary" className="text-xs capitalize">
              {selectedUser.role.replace('_', ' ')}
            </Badge>
          </div>
          {selectedUser.branches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedUser.branches.map((b) => (
                <Badge key={b} variant="outline" className="text-xs">
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current overrides */}
      {selectedUser && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Permission Overrides
            </p>
            <Button size="xs" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="size-3" />
              Add Override
            </Button>
          </div>

          {overridesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : overrides.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No overrides configured for this user.
            </p>
          ) : (
            <div className="space-y-1.5">
              {overrides.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ border: '0.5px solid var(--border)', background: 'var(--card)' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono">{o.permission_key}</code>
                      <Badge
                        variant={o.allowed ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {o.allowed ? 'Allow' : 'Deny'}
                      </Badge>
                      {o.branch_id && (
                        <Badge variant="outline" className="text-[10px]">
                          Branch-scoped
                        </Badge>
                      )}
                    </div>
                    {o.reason && (
                      <p className="text-[11px] text-muted-foreground">{o.reason}</p>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button variant="ghost" size="icon-xs">
                        <Trash2 className="size-3 text-red-400" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Override</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove the {o.allowed ? 'allow' : 'deny'} override
                          for <strong>{o.permission_key}</strong>? The user will revert to
                          role-based permissions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => onRemoveOverride(o.id, selectedUser.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add override form */}
      {showAddForm && selectedUser && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ border: '0.5px solid var(--border)', background: 'var(--card)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            New Override
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Permission</label>
              <Select value={newPermKey} onValueChange={(v) => setNewPermKey(v ?? '')}>
                <SelectTrigger size="sm" className="h-8 text-xs">
                  <SelectValue placeholder="Select permission..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PERMISSION_KEYS.map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Action</label>
              <Select value={newAllowed} onValueChange={(v) => setNewAllowed((v ?? 'deny') as 'allow' | 'deny')}>
                <SelectTrigger size="sm" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow" className="text-xs">Allow</SelectItem>
                  <SelectItem value="deny" className="text-xs">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Branch (optional)</label>
              <Select value={newBranch} onValueChange={(v) => setNewBranch(v ?? 'all')}>
                <SelectTrigger size="sm" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Branches</SelectItem>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Reason <span className="text-red-400">*</span>
              </label>
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Why this override?"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              disabled={!newPermKey || !newReason || addingOverride}
              onClick={handleAddOverride}
            >
              {addingOverride ? 'Adding...' : 'Add Override'}
            </Button>
          </div>
        </div>
      )}

      {/* Effective access preview */}
      {selectedUser && (
        <EffectiveAccessPreview
          access={effectiveAccess}
          loading={effectiveAccessLoading}
        />
      )}
    </div>
  )
}
