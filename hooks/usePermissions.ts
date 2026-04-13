'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Role,
  Permission,
  RolePermission,
  UserOverride,
} from '@/components/admin/permissions/types'

// ─── Roles ───────────────────────────────────────────────
export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('roles')
      .select('*')
      .order('name')
    setRoles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  return { roles, loading, refetch: fetchRoles }
}

// ─── Permission catalog ──────────────────────────────────
export function usePermissionCatalog() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()
      const { data } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
      setPermissions(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { permissions, loading }
}

// ─── Role permissions ────────────────────────────────────
export function useRolePermissions(roleId: string | null) {
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRolePermissions = useCallback(async (id: string) => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role_id', id)
    setRolePermissions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (roleId) fetchRolePermissions(roleId)
    else setRolePermissions([])
  }, [roleId, fetchRolePermissions])

  const saveRolePermissions = useCallback(
    async (id: string, permissions: Array<{ permission_key: string; allowed: boolean }>) => {
      const supabase = createClient()
      // Delete existing
      await supabase.from('role_permissions').delete().eq('role_id', id)
      // Insert new
      if (permissions.length > 0) {
        await supabase.from('role_permissions').insert(
          permissions.map((p) => ({
            role_id: id,
            permission_key: p.permission_key,
            allowed: p.allowed,
          }))
        )
      }
      // Refetch
      await fetchRolePermissions(id)
    },
    [fetchRolePermissions]
  )

  return { rolePermissions, loading, saveRolePermissions }
}

// ─── User overrides ──────────────────────────────────────
export function useUserOverrides(userId: string | null) {
  const [overrides, setOverrides] = useState<UserOverride[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOverrides = useCallback(async (id: string) => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('user_permission_overrides')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
    setOverrides(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userId) fetchOverrides(userId)
    else setOverrides([])
  }, [userId, fetchOverrides])

  const addOverride = useCallback(
    async (override: {
      user_id: string
      permission_key: string
      allowed: boolean
      branch_id?: string | null
      reason: string
    }) => {
      const supabase = createClient()
      await supabase.from('user_permission_overrides').insert({
        user_id: override.user_id,
        permission_key: override.permission_key,
        allowed: override.allowed,
        branch_id: override.branch_id || null,
        reason: override.reason,
      })
      await fetchOverrides(override.user_id)
    },
    [fetchOverrides]
  )

  const removeOverride = useCallback(
    async (overrideId: string, userId: string) => {
      const supabase = createClient()
      await supabase.from('user_permission_overrides').delete().eq('id', overrideId)
      await fetchOverrides(userId)
    },
    [fetchOverrides]
  )

  return { overrides, loading, addOverride, removeOverride, refetch: fetchOverrides }
}

// ─── Effective access ────────────────────────────────────
export function useEffectiveAccess(userId: string | null, branchId?: string | null) {
  const [access, setAccess] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const fetchAccess = useCallback(async () => {
    if (!userId) { setAccess({}); return }
    setLoading(true)
    const supabase = createClient()

    // Get the user's profile role (legacy)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    const legacyRoleKey =
      profile?.role === 'admin' ? 'system_admin' : profile?.role

    // Collect role IDs
    const roleIds = new Set<string>()
    if (legacyRoleKey) {
      const { data: legacyRole } = await supabase
        .from('roles')
        .select('id')
        .eq('key', legacyRoleKey)
        .single()
      if (legacyRole) roleIds.add(legacyRole.id)
    }

    const { data: assignments } = await supabase
      .from('user_role_assignments')
      .select('role_id, branch_id')
      .eq('user_id', userId)

    if (assignments) {
      for (const a of assignments) {
        if (!a.branch_id || !branchId || a.branch_id === branchId) {
          roleIds.add(a.role_id)
        }
      }
    }

    // Get all permission keys
    const { data: allPerms } = await supabase
      .from('permissions')
      .select('key')
      .order('module')

    if (!allPerms) { setAccess({}); setLoading(false); return }

    // Get role permissions
    const rolePermMap: Record<string, boolean> = {}
    if (roleIds.size > 0) {
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permission_key, allowed')
        .in('role_id', Array.from(roleIds))

      if (rolePerms) {
        for (const rp of rolePerms) {
          if (rp.allowed) rolePermMap[rp.permission_key] = true
        }
      }
    }

    // Get user overrides
    const { data: overrideData } = await supabase
      .from('user_permission_overrides')
      .select('permission_key, allowed, branch_id')
      .eq('user_id', userId)

    // Compute effective
    const effective: Record<string, boolean> = {}
    for (const p of allPerms) {
      let allowed = rolePermMap[p.key] ?? false
      if (overrideData) {
        for (const o of overrideData) {
          if (o.permission_key !== p.key) continue
          if (!o.branch_id || !branchId || o.branch_id === branchId) {
            allowed = o.allowed
          }
        }
        const hasDeny = overrideData.some(
          (o) =>
            o.permission_key === p.key &&
            !o.allowed &&
            (!o.branch_id || !branchId || o.branch_id === branchId)
        )
        if (hasDeny) allowed = false
      }
      effective[p.key] = allowed
    }

    setAccess(effective)
    setLoading(false)
  }, [userId, branchId])

  useEffect(() => { fetchAccess() }, [fetchAccess])

  return { access, loading, refetch: fetchAccess }
}
