import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../helpers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { userId } = await params
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branchId') || null

  // 1. Get the user's profile role (legacy)
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const legacyRoleKey =
    profile?.role === 'admin' ? 'system_admin' : profile?.role

  // 2. Get legacy role ID
  const roleIds = new Set<string>()
  if (legacyRoleKey) {
    const { data: legacyRole } = await auth.supabase
      .from('roles')
      .select('id')
      .eq('key', legacyRoleKey)
      .single()
    if (legacyRole) roleIds.add(legacyRole.id)
  }

  // 3. Get user_role_assignments
  const { data: assignments } = await auth.supabase
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

  // 4. Get all permission keys
  const { data: allPerms } = await auth.supabase
    .from('permissions')
    .select('key, module, action, description')
    .order('module')

  if (!allPerms) return NextResponse.json({})

  // 5. Get role permissions for collected roles
  let rolePermMap: Record<string, boolean> = {}
  if (roleIds.size > 0) {
    const { data: rolePerms } = await auth.supabase
      .from('role_permissions')
      .select('permission_key, allowed')
      .in('role_id', Array.from(roleIds))

    if (rolePerms) {
      for (const rp of rolePerms) {
        if (rp.allowed) rolePermMap[rp.permission_key] = true
      }
    }
  }

  // 6. Get user overrides
  const { data: overrides } = await auth.supabase
    .from('user_permission_overrides')
    .select('permission_key, allowed, branch_id')
    .eq('user_id', userId)

  // 7. Compute effective access
  const effective: Record<string, boolean> = {}
  for (const p of allPerms) {
    let allowed = rolePermMap[p.key] ?? false

    if (overrides) {
      for (const o of overrides) {
        if (o.permission_key !== p.key) continue
        if (!o.branch_id || !branchId || o.branch_id === branchId) {
          allowed = o.allowed
        }
      }
      // Explicit deny wins
      const hasDeny = overrides.some(
        (o) =>
          o.permission_key === p.key &&
          !o.allowed &&
          (!o.branch_id || !branchId || o.branch_id === branchId)
      )
      if (hasDeny) allowed = false
    }

    effective[p.key] = allowed
  }

  return NextResponse.json(effective)
}
