import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecapsClient } from './RecapsClient'

export default async function RecapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <RecapsClient />
}
