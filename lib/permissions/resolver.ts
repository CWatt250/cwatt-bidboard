import { createClient } from '@/lib/supabase/client'

/**
 * Permission Resolver
 *
 * Resolution order:
 * 1. Default deny
 * 2. Apply role permissions for user's assigned roles (global + branch-specific)
 * 3. Apply user overrides
 * 4. Explicit deny override wins
 */

export async function hasPermission(
  userId: string,
  permissionKey: string,
  branchId?: string | null
): Promise<boolean> {
  const supabase = createClient()

  // 1. Get user's role assignments
  const { data: assignments } = await supabase
    .from('user_role_assignments')
    .select('role_id, branch_id')
    .eq('user_id', userId)

  // Also check the user's legacy profile role (from profiles table)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // 2. Collect all applicable role IDs
  const roleIds = new Set<string>()

  // Legacy role mapping — look up role by key matching profile.role
  if (profile?.role) {
    const legacyRoleKey =
      profile.role === 'admin' ? 'system_admin' : profile.role
    const { data: legacyRole } = await supabase
      .from('roles')
      .select('id')
      .eq('key', legacyRoleKey)
      .single()
    if (legacyRole) roleIds.add(legacyRole.id)
  }

  // Branch-scoped assignments
  if (assignments) {
    for (const a of assignments) {
      // Global assignment (no branch) always applies
      if (!a.branch_id) {
        roleIds.add(a.role_id)
      }
      // Branch-scoped assignment applies when checking that branch or no branch specified
      if (a.branch_id && (!branchId || a.branch_id === branchId)) {
        roleIds.add(a.role_id)
      }
    }
  }

  // 2. Default deny — if no roles, check overrides only
  let allowed = false

  if (roleIds.size > 0) {
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('allowed')
      .in('role_id', Array.from(roleIds))
      .eq('permission_key', permissionKey)

    // If any role grants the permission, allow it
    if (rolePerms?.some((rp) => rp.allowed)) {
      allowed = true
    }
  }

  // 3. Apply user overrides
  const { data: overrides } = await supabase
    .from('user_permission_overrides')
    .select('allowed, branch_id')
    .eq('user_id', userId)
    .eq('permission_key', permissionKey)

  if (overrides && overrides.length > 0) {
    for (const o of overrides) {
      // Global override (no branch) always applies
      if (!o.branch_id) {
        allowed = o.allowed
      }
      // Branch-scoped override
      if (o.branch_id && (!branchId || o.branch_id === branchId)) {
        allowed = o.allowed
      }
    }

    // 4. Explicit deny wins — if any matching override is deny, deny
    const hasDeny = overrides.some(
      (o) =>
        !o.allowed &&
        (!o.branch_id || !branchId || o.branch_id === branchId)
    )
    if (hasDeny) allowed = false
  }

  return allowed
}

/**
 * Compute effective access for a user across all permission keys.
 * Returns a map of permission_key → boolean.
 */
export async function getEffectiveAccess(
  userId: string,
  branchId?: string | null
): Promise<Record<string, boolean>> {
  const supabase = createClient()

  // Fetch all permission keys
  const { data: allPerms } = await supabase
    .from('permissions')
    .select('key')
    .order('module')

  if (!allPerms) return {}

  const results: Record<string, boolean> = {}
  for (const p of allPerms) {
    results[p.key] = await hasPermission(userId, p.key, branchId)
  }

  return results
}
