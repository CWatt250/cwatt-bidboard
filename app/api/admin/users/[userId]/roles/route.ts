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
    .from('user_role_assignments')
    .select('*, roles(key, name)')
    .eq('user_id', userId)

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
    assignments: Array<{ role_id: string; branch_id: string }>
  } = await request.json()

  // Delete existing assignments, then re-insert
  const { error: delError } = await auth.supabase
    .from('user_role_assignments')
    .delete()
    .eq('user_id', userId)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (body.assignments.length > 0) {
    const rows = body.assignments.map((a) => ({
      user_id: userId,
      role_id: a.role_id,
      branch_id: a.branch_id,
    }))

    const { error: insError } = await auth.supabase
      .from('user_role_assignments')
      .insert(rows)

    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
  }

  const { data } = await auth.supabase
    .from('user_role_assignments')
    .select('*, roles(key, name)')
    .eq('user_id', userId)

  return NextResponse.json(data)
}
