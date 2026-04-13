import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { roleId } = await params

  const { data, error } = await auth.supabase
    .from('role_permissions')
    .select('*')
    .eq('role_id', roleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { roleId } = await params
  const body: { permissions: Array<{ permission_key: string; allowed: boolean }> } =
    await request.json()

  // Delete existing role permissions, then re-insert
  const { error: delError } = await auth.supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (body.permissions.length > 0) {
    const rows = body.permissions.map((p) => ({
      role_id: roleId,
      permission_key: p.permission_key,
      allowed: p.allowed,
    }))

    const { error: insError } = await auth.supabase
      .from('role_permissions')
      .insert(rows)

    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
  }

  // Return updated permissions
  const { data } = await auth.supabase
    .from('role_permissions')
    .select('*')
    .eq('role_id', roleId)

  return NextResponse.json(data)
}
