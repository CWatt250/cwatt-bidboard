import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Verify the caller is a system_admin. Returns the supabase client if authorized,
 * or a 403 NextResponse if not.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }) }
  }

  return { supabase, userId: user.id }
}
