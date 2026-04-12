import { NextResponse } from 'next/server'
import { requireAdmin } from '../../helpers'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.supabase
    .from('permissions')
    .select('*')
    .order('module')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
