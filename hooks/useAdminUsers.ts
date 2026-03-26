'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listAuthUsers } from '@/app/actions/adminUsers'
import type { Branch, UserRole } from '@/lib/supabase/types'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  branches: Branch[]
  is_active: boolean
  created_at: string
}

interface UseAdminUsersResult {
  users: AdminUser[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAdminUsers(): UseAdminUsersResult {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const [profilesRes, authUsers] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, role, is_active, created_at, user_branches(branch)')
          .order('name'),
        listAuthUsers(),
      ])

      if (profilesRes.error) throw new Error(profilesRes.error.message)

      const emailMap = new Map(authUsers.map((u) => [u.id, u.email]))

      const mapped: AdminUser[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: emailMap.get(p.id) ?? '',
        role: p.role as UserRole,
        branches: ((p.user_branches ?? []) as Array<{ branch: string }>).map(
          (ub) => ub.branch as Branch
        ),
        is_active: p.is_active,
        created_at: p.created_at,
      }))

      setUsers(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => { fetchUsers() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_branches' },
        () => { fetchUsers() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchUsers])

  return { users, loading, error, refetch: fetchUsers }
}
