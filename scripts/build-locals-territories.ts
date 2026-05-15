import fs from 'fs'
import path from 'path'
import { FIPS_TO_LOCAL, LOCALS, type LocalNumber } from '../config/locals'

// US counties GeoJSON from the US Census Bureau cartographic boundary files (20m simplified)
const COUNTIES_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'

interface GeoFeature {
  type: 'Feature'
  id?: string | number
  properties: Record<string, string | number | null>
  geometry: { type: string; coordinates: unknown }
}

interface GeoFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

async function fetchCounties(): Promise<GeoFeatureCollection> {
  console.log('Downloading US counties GeoJSON...')
  const res = await fetch(COUNTIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.status} ${res.statusText}`)
  return res.json() as Promise<GeoFeatureCollection>
}

async function main() {
  const data = await fetchCounties()
  console.log(`Total US counties: ${data.features.length}`)

  const filtered: GeoFeature[] = []

  for (const feature of data.features) {
    // The plotly dataset stores FIPS as the "id" property (5-digit zero-padded string)
    const fips =
      typeof feature.id !== 'undefined'
        ? String(feature.id).padStart(5, '0')
        : String(feature.properties?.['GEOID'] ?? feature.properties?.['fips'] ?? '').padStart(5, '0')

    const localNum = FIPS_TO_LOCAL[fips]
    if (!localNum) continue

    const localInfo = LOCALS[localNum as LocalNumber]
    filtered.push({
      ...feature,
      properties: {
        ...feature.properties,
        fips,
        local_number: localNum,
        local_color: localInfo.color,
        local_name: localInfo.name,
      },
    })
  }

  console.log(`Counties in locals jurisdiction: ${filtered.length}`)

  const output: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: filtered,
  }

  const outPath = path.join(process.cwd(), 'public', 'locals-territories.geojson')
  fs.writeFileSync(outPath, JSON.stringify(output))

  const stats = fs.statSync(outPath)
  console.log(`Written to ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
