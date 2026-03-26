import { createClient } from '@/lib/supabase/client'

/**
 * Logs a bid activity entry. Silently ignores errors (e.g. if the table
 * doesn't exist yet or there's a permissions issue).
 */
export async function logActivity(
  bidId: string,
  userId: string,
  action: string
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('bid_activity')
    .insert({ bid_id: bidId, user_id: userId, action })
}
