import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves a client name to its id in the clients table, creating a new row
 * if none exists. Returns null for empty/whitespace names.
 */
export async function ensureClientId(
  supabase: SupabaseClient,
  name: string
): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from('clients')
    .insert({ name: trimmed })
    .select('id')
    .single()

  if (error || !created) return null
  return created.id as string
}
