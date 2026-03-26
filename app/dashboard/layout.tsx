import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FiltersProvider } from '@/contexts/filters'
import { Sidebar, TopBar } from './sidebar-client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  const userName = profile?.name ?? user.email ?? 'User'

  return (
    <FiltersProvider>
      <Sidebar profiles={profiles ?? []} />
      <TopBar userName={userName} />
      <main className="ml-60 mt-14 p-6 min-h-screen">
        {children}
      </main>
    </FiltersProvider>
  )
}
