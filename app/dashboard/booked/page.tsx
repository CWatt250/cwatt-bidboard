import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookedWorkClient } from './BookedWorkClient'

export const metadata: Metadata = {
  title: 'Booked Work — BidWatt',
  description: 'Awarded and verbal bids organized by branch',
}

export default async function BookedWorkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <BookedWorkClient />
}
