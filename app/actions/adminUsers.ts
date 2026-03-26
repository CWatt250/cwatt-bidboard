'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface AuthUser {
  id: string
  email: string
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(error.message)
  return (data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? '' }))
}

export async function createAuthUser(params: {
  email: string
  password: string
  name: string
  role: string
  branches: string[]
}): Promise<{ id: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { name: params.name },
  })

  if (error) throw new Error(error.message)
  const userId = data.user.id

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId,
    name: params.name,
    role: params.role,
    is_active: true,
  })
  if (profileErr) throw new Error(profileErr.message)

  if (params.branches.length > 0) {
    const { error: branchErr } = await supabase.from('user_branches').insert(
      params.branches.map((b) => ({ user_id: userId, branch: b }))
    )
    if (branchErr) throw new Error(branchErr.message)
  }

  return { id: userId }
}

export async function updateUserProfile(params: {
  userId: string
  name: string
  role: string
  branches: string[]
  is_active: boolean
}): Promise<void> {
  const supabase = createAdminClient()

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ name: params.name, role: params.role, is_active: params.is_active })
    .eq('id', params.userId)

  if (profileErr) throw new Error(profileErr.message)

  // Delete existing branches then re-insert
  const { error: delErr } = await supabase
    .from('user_branches')
    .delete()
    .eq('user_id', params.userId)

  if (delErr) throw new Error(delErr.message)

  if (params.branches.length > 0) {
    const { error: insErr } = await supabase.from('user_branches').insert(
      params.branches.map((b) => ({ user_id: params.userId, branch: b }))
    )
    if (insErr) throw new Error(insErr.message)
  }
}
