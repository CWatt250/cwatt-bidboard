import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FiltersProvider } from '@/contexts/filters'
import { BidDetailProvider } from '@/contexts/bidDetail'
import { UserRoleProvider } from '@/contexts/userRole'
import { BidDetailDrawer } from '@/components/shared/BidDetailDrawer'
import { Sidebar, TopBar } from './sidebar-client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: profilesRaw }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase.from('profiles').select('id, name, user_branches(branch)').order('name'),
  ])

  const profiles = (profilesRaw ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    branches: (p.user_branches ?? []).map((ub: any) => ub.branch) as string[],
  }))

  const userName = profile?.name ?? user.email ?? 'User'

  return (
    <UserRoleProvider>
      <FiltersProvider>
        <BidDetailProvider profiles={profiles ?? []}>
          <Sidebar profiles={profiles ?? []} />
          <TopBar userName={userName} />
          <main className="ml-60 mt-16 p-6 min-h-screen" style={{ background: 'var(--bg)' }}>
            {children}
          </main>
          <BidDetailDrawer />
        </BidDetailProvider>
      </FiltersProvider>
    </UserRoleProvider>
  )
}
