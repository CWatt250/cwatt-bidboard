'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Branch, UserRole } from '@/lib/supabase/types'

interface UserRoleState {
  profile: Profile | null
  role: UserRole | null
  branches: Branch[]
  isAdmin: boolean
  isBranchManager: boolean
  isEstimator: boolean
  loading: boolean
}

const UserRoleContext = createContext<UserRoleState | null>(null)

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<UserRoleState>({
    profile: null,
    role: null,
    branches: [],
    isAdmin: false,
    isBranchManager: false,
    isEstimator: false,
    loading: true,
  })

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, is_active, created_at, user_branches(branch)')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        await supabase.auth.signOut()
        router.push('/login?error=profile_fetch_failed')
        return
      }

      if (!data.is_active) {
        await supabase.auth.signOut()
        router.push('/login?error=account_inactive')
        return
      }

      const branches: Branch[] = ((data as any).user_branches ?? []).map((ub: any) => ub.branch as Branch)
      const profile: Profile = {
        id: data.id,
        name: data.name,
        role: data.role as UserRole,
        is_active: data.is_active,
        created_at: data.created_at,
        branches,
      }

      setState({
        profile,
        role: profile.role,
        branches,
        isAdmin: profile.role === 'admin',
        isBranchManager: profile.role === 'branch_manager',
        isEstimator: profile.role === 'estimator',
        loading: false,
      })
    }

    fetchProfile()
  }, [router])

  return (
    <UserRoleContext.Provider value={state}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider')
  return ctx
}
