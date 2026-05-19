import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function audit() {
  // Profiles
  const { data: profiles } = await supabase.from('profiles').select('id, name, role, raw_user_meta_data')
  console.log('=== ALL PROFILES ===')
  if (profiles) {
    for (const p of profiles) {
      const meta = p.raw_user_meta_data as any
      console.log(`  ${p.name?.padEnd(25)} ${p.id}  role:${p.role}  email:${meta?.email ?? 'N/A'}`)
    }
  }
  
  // The estimator_id used by the user's session determines what they see.
  // Let's check who owns what bids
  const { data: allBids } = await supabase.from('bids').select('id, status, estimator_id, branch, bid_due_date, updated_at')
  if (!allBids) return
  
  // Map estimator_id to count
  const byEstimator = allBids.reduce((acc, b) => {
    const eid = b.estimator_id ?? 'NULL'
    if (!acc[eid]) acc[eid] = { total: 0, awarded: 0, sent: 0, open: 0, lost: 0, verbal: 0, unassigned: 0 }
    acc[eid].total++
    if (b.status === 'Awarded') acc[eid].awarded++
    else if (b.status === 'Sent') acc[eid].sent++
    else if (b.status === 'Bidding' || b.status === 'In Progress') acc[eid].open++
    else if (b.status === 'Lost') acc[eid].lost++
    else if (b.status === 'Verbal') acc[eid].verbal++
    else if (b.status === 'Unassigned') acc[eid].unassigned++
    return acc
  }, {} as Record<string, any>)
  
  console.log('\n=== BIDS BY ESTIMATOR ID ===')
  for (const [eid, counts] of Object.entries(byEstimator)) {
    console.log(`  ${eid === 'NULL' ? 'NULL (no estimator)' : eid.padEnd(36)} total:${counts.total}  awarded:${counts.awarded}  sent:${counts.sent}  open:${counts.open}  lost:${counts.lost}  verbal:${counts.verbal}  unassigned:${counts.unassigned}`)
  }
}

audit().catch(console.error)
