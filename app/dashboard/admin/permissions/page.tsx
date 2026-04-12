'use client'

import { useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleList } from '@/components/admin/permissions/RoleList'
import { PermissionMatrix } from '@/components/admin/permissions/PermissionMatrix'
import { BranchScopeSelector } from '@/components/admin/permissions/BranchScopeSelector'
import { UserOverridesPanel } from '@/components/admin/permissions/UserOverridesPanel'
import type { Role } from '@/components/admin/permissions/types'
import {
  useRoles,
  useRolePermissions,
  useUserOverrides,
  useEffectiveAccess,
} from '@/hooks/usePermissions'
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers'

type Tab = 'roles' | 'overrides'

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('roles')

  // ─── Roles tab state ─────────────────────────
  const { roles, loading: rolesLoading } = useRoles()
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const {
    rolePermissions,
    loading: rolePermsLoading,
    saveRolePermissions,
  } = useRolePermissions(selectedRole?.id ?? null)

  // Branch scope (for display context only — permissions are global per role)
  const [allBranches, setAllBranches] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // ─── Overrides tab state ─────────────────────
  const { users } = useAdminUsers()
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const {
    overrides,
    loading: overridesLoading,
    addOverride,
    removeOverride,
  } = useUserOverrides(selectedUser?.id ?? null)
  const { access: effectiveAccess, loading: effectiveLoading } = useEffectiveAccess(
    selectedUser?.id ?? null,
    allBranches ? null : selectedBranch
  )

  const handleSaveRolePermissions = useCallback(
    async (permissions: Array<{ permission_key: string; allowed: boolean }>) => {
      if (!selectedRole) return
      await saveRolePermissions(selectedRole.id, permissions)
    },
    [selectedRole, saveRolePermissions]
  )

  const tabStyle = (tab: Tab) => ({
    padding: '6px 14px',
    fontSize: '0.8125rem',
    fontWeight: activeTab === tab ? 600 : 400,
    borderBottom: `2px solid ${activeTab === tab ? '#38bdf8' : 'transparent'}`,
    color: activeTab === tab ? '#38bdf8' : 'var(--text3)',
    cursor: 'pointer' as const,
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: activeTab === tab ? '#38bdf8' : 'transparent',
    transition: 'all 150ms ease',
  })

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Roles | User Overrides */}
      <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        <button style={tabStyle('roles')} onClick={() => setActiveTab('roles')}>
          Role Permissions
        </button>
        <button style={tabStyle('overrides')} onClick={() => setActiveTab('overrides')}>
          User Overrides
        </button>
      </div>

      {/* Branch scope selector (shared) */}
      <BranchScopeSelector
        allBranches={allBranches}
        selectedBranch={selectedBranch}
        onToggleAll={() => {
          setAllBranches(true)
          setSelectedBranch(null)
        }}
        onSelectBranch={(code) => {
          setAllBranches(false)
          setSelectedBranch(code)
        }}
      />

      {/* ─── Roles Tab ─── */}
      {activeTab === 'roles' && (
        <div className="flex gap-6">
          {/* Left panel: role list (280px) */}
          <div style={{ width: 280, minWidth: 280 }}>
            {rolesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <RoleList
                roles={roles}
                selectedRoleId={selectedRole?.id ?? null}
                onSelectRole={setSelectedRole}
              />
            )}
          </div>

          {/* Main panel: permission matrix */}
          <div className="flex-1 min-w-0">
            <PermissionMatrix
              role={selectedRole}
              rolePermissions={rolePermissions}
              loading={rolePermsLoading}
              onSave={handleSaveRolePermissions}
            />
          </div>
        </div>
      )}

      {/* ─── Overrides Tab ─── */}
      {activeTab === 'overrides' && (
        <UserOverridesPanel
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            branches: u.branches,
          }))}
          selectedUser={
            selectedUser
              ? {
                  id: selectedUser.id,
                  name: selectedUser.name,
                  email: selectedUser.email,
                  role: selectedUser.role,
                  branches: selectedUser.branches,
                }
              : null
          }
          onSelectUser={(u) => {
            const full = users.find((au) => au.id === u.id)
            if (full) setSelectedUser(full)
          }}
          overrides={overrides}
          overridesLoading={overridesLoading}
          onAddOverride={addOverride}
          onRemoveOverride={removeOverride}
          effectiveAccess={effectiveAccess}
          effectiveAccessLoading={effectiveLoading}
        />
      )}
    </div>
  )
}
