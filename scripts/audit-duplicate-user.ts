import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function audit() {
  // Find all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role, is_active')
  console.log('ALL PROFILES:', JSON.stringify(profiles, null, 2))

  // Count bids assigned to each profile
  const { data: bidCounts } = await supabase
    .from('bids')
    .select('estimator_id, count:id')
  console.log('BIDS PER ESTIMATOR:', JSON.stringify(bidCounts, null, 2))

  // Find bids assigned to cwatt@gmail.com account specifically
  const duplicate = profiles?.find(p => p.name?.includes('Admin') || p.name === 'Colton Watt Admin')
  if (duplicate) {
    const { data: theirBids } = await supabase
      .from('bids')
      .select('id, project_name, status')
      .eq('estimator_id', duplicate.id)
    console.log('DUPLICATE USER ID:', duplicate.id)
    console.log('THEIR BIDS:', JSON.stringify(theirBids, null, 2))
  }
}

audit()
