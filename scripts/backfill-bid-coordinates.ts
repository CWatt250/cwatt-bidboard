import { createAdminClient } from '../lib/supabase/admin'

// Run after migration 022_add_bid_coordinates.sql is applied.
// Usage: tsx scripts/backfill-bid-coordinates.ts

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
if (!MAPBOX_TOKEN) {
  console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN')
  process.exit(1)
}

interface Bid {
  id: string
  project_location: string
}

interface MapboxResponse {
  features?: { center: [number, number] }[]
}

async function geocode(placeName: string): Promise<{ longitude: number; latitude: number } | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(placeName)}.json` +
    `?access_token=${MAPBOX_TOKEN}&country=us&limit=1`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  Mapbox error ${res.status} for "${placeName}"`)
    return null
  }
  const data = (await res.json()) as MapboxResponse
  const center = data.features?.[0]?.center
  if (!center) return null
  return { longitude: center[0], latitude: center[1] }
}

async function main() {
  const supabase = createAdminClient()

  const { data: bids, error } = await supabase
    .from('bids')
    .select('id, project_location')
    .in('status', ['Awarded', 'Verbal'])
    .is('latitude', null)
    .not('project_location', 'is', null)
    .neq('project_location', '')

  if (error) {
    console.error('Failed to fetch bids:', error.message)
    process.exit(1)
  }

  const rows = (bids ?? []) as Bid[]
  console.log(`Found ${rows.length} bids to geocode`)

  let success = 0
  let skipped = 0

  for (const bid of rows) {
    console.log(`[${bid.id}] "${bid.project_location}"`)
    try {
      const coords = await geocode(bid.project_location)
      if (!coords) {
        console.log('  → no match, skipping')
        skipped++
        continue
      }
      const { error: updateError } = await supabase
        .from('bids')
        .update({ latitude: coords.latitude, longitude: coords.longitude })
        .eq('id', bid.id)
      if (updateError) {
        console.warn(`  → update failed: ${updateError.message}`)
        skipped++
      } else {
        console.log(`  → (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`)
        success++
      }
    } catch (err) {
      console.warn(`  → error: ${(err as Error).message}`)
      skipped++
    }
    // Respect Mapbox free tier rate limit (~600 req/min)
    await new Promise((r) => setTimeout(r, 110))
  }

  console.log(`\nDone. ${success} updated, ${skipped} skipped.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
