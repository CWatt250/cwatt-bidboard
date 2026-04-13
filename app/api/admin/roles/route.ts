import { NextResponse } from 'next/server'
import { requireAdmin } from '../helpers'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.supabase
    .from('roles')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { key, name, description } = body

  if (!key || !name) {
    return NextResponse.json({ error: 'key and name are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('roles')
    .insert({ key, name, description, is_system_role: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
