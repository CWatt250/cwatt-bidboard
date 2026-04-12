import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { userId } = await params

  const { data, error } = await auth.supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { userId } = await params
  const body: {
    overrides: Array<{
      permission_key: string
      allowed: boolean
      branch_id?: string | null
      reason: string
    }>
  } = await request.json()

  // Delete existing overrides, then re-insert
  const { error: delError } = await auth.supabase
    .from('user_permission_overrides')
    .delete()
    .eq('user_id', userId)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (body.overrides.length > 0) {
    const rows = body.overrides.map((o) => ({
      user_id: userId,
      permission_key: o.permission_key,
      allowed: o.allowed,
      branch_id: o.branch_id || null,
      reason: o.reason,
    }))

    const { error: insError } = await auth.supabase
      .from('user_permission_overrides')
      .insert(rows)

    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
  }

  const { data } = await auth.supabase
    .from('user_permission_overrides')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data)
}
