import * as fs from 'fs'
import * as path from 'path'
import { LOCALS, type LocalNumber } from '../config/locals'

// US counties GeoJSON from the US Census Bureau cartographic boundary files (20m simplified)
const COUNTIES_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'

// ── Assignment rules ported from subwatt-v2 ─────────────────────────────────
// Source: supabase/build_fips_map.js + supabase/fill_id_wy.js
//
// Notes:
//   - "statewide(fips)" means every county in that state.
//   - "list(state, names)" means specific counties by name.
//   - For ID/WY, fill_id_wy.js assigns all remaining counties to a local
//     per the CBA (no county left unmapped in those states).
//
// Priority order (later assignments overwrite earlier):
//   1. Original 7/36/82 mapping from data.json (already in FIPS_TO_LOCAL)
//   2. Local 28 — CO statewide + 6 SE WY counties
//   3. Local 73 — AZ statewide
//   4. Local 69 — UT statewide + parts NV/ID/WY
//   5. Local 16 — N CA + NW NV
//   6. Local 76 — NM statewide + W TX + SW CO (overwrites some CO from L28)
//   7. Local 135 — S NV (Clark, Lincoln, Nye, Esmeralda)
//   8. fill_id_wy: remaining ID counties → L69 (panhandle → L82), remaining WY → L69 or L28
// ────────────────────────────────────────────────────────────────────────────

interface CountyFipsMap {
  [fips: string]: number // 5-char FIPS → local number
}

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

// ── Helper: build reverse lookup for county name → FIPS from the data ───────
interface CountyMetadata {
  fips: string
  name: string | null
  stateFips: string
}

function indexCounties(data: GeoFeatureCollection): {
  byNameState: Record<string, string> // "state|name" → fips
  byState: Record<string, CountyMetadata[]>
} {
  const byNameState: Record<string, string> = {}
  const byState: Record<string, CountyMetadata[]> = {}

  for (const feature of data.features) {
    const fips = String(feature.id).padStart(5, '0')
    const stateFips = fips.slice(0, 2)
    const name = String(feature.properties?.NAME ?? '')
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()

    byNameState[`${stateFips}|${name}`] = fips

    if (!byState[stateFips]) byState[stateFips] = []
    byState[stateFips].push({ fips, name: feature.properties?.NAME as string | null, stateFips })
  }

  return { byNameState, byState }
}

function statewide(
  stateFips: string,
  byState: Record<string, CountyMetadata[]>,
): string[] {
  return (byState[stateFips] || []).map((c) => c.fips)
}

function listFips(
  stateFips: string,
  names: string[],
  byNameState: Record<string, string>,
): string[] {
  const out: string[] = []
  const miss: string[] = []

  for (const raw of names) {
    const cleaned = String(raw)
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .replace(/ county\b/, '')
      .trim()
    const fips = byNameState[`${stateFips}|${cleaned}`]
    if (fips) {
      out.push(fips)
    } else {
      miss.push(raw)
    }
  }

  if (miss.length) {
    console.warn(`  WARN: missing counties in state ${stateFips}: ${miss.join(', ')}`)
  }

  return out
}

function assign(map: CountyFipsMap, localId: number, fipsArr: string[]) {
  for (const f of fipsArr) {
    map[f] = localId
  }
}

// ── All 50 states FIPS to keep the build script clean ───────────────────────
const LOCAL_16_STATES = ['06', '32']
const LOCAL_28_STATES = ['08', '56']
const LOCAL_69_STATES = ['49', '32', '56', '16']
const LOCAL_73_STATES = ['04']
const LOCAL_76_STATES = ['35', '48', '08']
const LOCAL_135_STATES = ['32']
const LOCAL_82_STATES = ['53', '16', '30']
const LOCAL_36_STATES = ['41', '53']
const LOCAL_7_STATES = ['53']

// ── Build the FIPS→local map ───────────────────────────────────────────────
function buildFipsToLocal(data: GeoFeatureCollection): CountyFipsMap {
  const map: CountyFipsMap = {}
  const { byNameState, byState } = indexCounties(data)

  // ── Phase 1: Original 3 locals (7, 36, 82) ──
  // These match the existing FIPS_TO_LOCAL from data.json / current codebase.
  // WA counties
  assign(map, 7, ['53007', '53009', '53017', '53027', '53029', '53031', '53033', '53035',
    '53037', '53041', '53045', '53047', '53049', '53053', '53055', '53057', '53061',
    '53067', '53073', '53077'])
  assign(map, 36, ['53011', '53015', '53039', '53059', '53069'])
  assign(map, 82, ['53001', '53003', '53005', '53013', '53019', '53021',
    '53023', '53025', '53043', '53051', '53063', '53065', '53071', '53075'])
  // OR counties
  assign(map, 36, [
    '41001', '41003', '41005', '41007', '41009', '41011', '41013', '41015',
    '41017', '41019', '41021', '41023', '41025', '41027', '41029', '41031',
    '41033', '41035', '41037', '41039', '41041', '41043', '41045', '41047',
    '41049', '41051', '41053', '41055', '41057', '41059', '41061', '41063',
    '41065', '41067', '41069', '41071',
  ])
  // ID panhandle (L82)
  assign(map, 82, ['16009', '16017', '16021', '16035', '16049', '16055',
    '16057', '16061', '16069', '16079'])
  // MT (L82)
  assign(map, 82, [
    '30001', '30003', '30005', '30007', '30009', '30011', '30013', '30015',
    '30017', '30019', '30021', '30023', '30025', '30027', '30029', '30031',
    '30033', '30035', '30037', '30039', '30041', '30043', '30045', '30047',
    '30049', '30051', '30053', '30055', '30057', '30059', '30061', '30063',
    '30065', '30067', '30069', '30071', '30073', '30075', '30077', '30079',
    '30081', '30083', '30085', '30087', '30089', '30091', '30093', '30095',
    '30097', '30099', '30101', '30103', '30105', '30107', '30109', '30111',
  ])

  // ── Phase 2: Local 28 — CO statewide + SE WY ──
  assign(map, 28, statewide('08', byState))
  assign(map, 28, listFips('56', ['Albany', 'Carbon', 'Goshen', 'Laramie', 'Niobrara', 'Platte'], byNameState))

  // ── Phase 3: Local 73 — AZ statewide ──
  assign(map, 73, statewide('04', byState))

  // ── Phase 4: Local 69 — UT statewide + parts NV/ID/WY ──
  assign(map, 69, statewide('49', byState))
  assign(map, 69, listFips('32', ['White Pine', 'Eureka', 'Elko'], byNameState))
  assign(map, 69, listFips('56', ['Sweetwater', 'Uinta', 'Lincoln'], byNameState))
  assign(map, 69, listFips('16', [
    'Bear Lake', 'Franklin', 'Caribou', 'Bannock', 'Bingham',
    'Bonneville', 'Power', 'Oneida', 'Cassia',
  ], byNameState))

  // ── Phase 5: Local 16 — N CA + NW NV ──
  assign(map, 16, listFips('06', [
    'Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco',
    'San Mateo', 'Santa Clara', 'Solano', 'Sonoma',
    'Sacramento', 'Yolo', 'Sutter', 'Placer', 'El Dorado',
    'Nevada', 'Sierra', 'Plumas', 'Lassen', 'Modoc', 'Siskiyou',
    'Shasta', 'Tehama', 'Glenn', 'Butte', 'Colusa', 'Yuba',
    'Mendocino', 'Lake', 'Humboldt', 'Del Norte', 'Trinity',
    'San Joaquin', 'Stanislaus', 'Merced', 'Madera', 'Mariposa',
    'Tuolumne', 'Calaveras', 'Amador', 'Alpine',
    'Monterey', 'San Benito', 'Santa Cruz',
  ], byNameState))
  assign(map, 16, listFips('32', [
    'Washoe', 'Carson City', 'Storey', 'Douglas', 'Lyon',
    'Mineral', 'Pershing', 'Humboldt', 'Lander', 'Churchill',
  ], byNameState))

  // ── Phase 6: Local 76 — NM statewide + W TX + SW CO ──
  assign(map, 76, statewide('35', byState))
  assign(map, 76, listFips('48', [
    'Brewster', 'Culberson', 'El Paso', 'Hudspeth', 'Jeff Davis', 'Presidio',
  ], byNameState))
  // Overwrites Local 28's claim for these 5 SW CO counties
  assign(map, 76, listFips('08', [
    'Archuleta', 'Conejos', 'Costilla', 'La Plata', 'Montezuma',
  ], byNameState))

  // ── Phase 7: Local 135 — S NV ──
  assign(map, 135, listFips('32', ['Clark', 'Lincoln', 'Nye', 'Esmeralda'], byNameState))

  // ── Phase 8: fill_id_wy — complete remaining ID and WY counties ──
  // L69 ID counties (from fill_id_wy.js L69_ID array)
  assign(map, 69, listFips('16', [
    'Washington', 'Gem', 'Payette', 'Canyon', 'Ada', 'Boise',
    'Elmore', 'Owyhee', 'Custer', 'Camas', 'Blaine', 'Butte',
    'Clark', 'Jefferson', 'Twin Falls', 'Cassia', 'Power',
    'Bannock', 'Caribou', 'Oneida', 'Franklin', 'Bear Lake',
    'Adams', 'Valley', 'Lemhi', 'Gooding', 'Lincoln', 'Jerome',
    'Minidoka', 'Bingham', 'Fremont', 'Madison', 'Teton', 'Bonneville',
  ], byNameState))

  // L69 WY counties (from fill_id_wy.js L69_WY array)
  assign(map, 69, listFips('56', [
    'Sweetwater', 'Uinta', 'Lincoln', 'Sublette', 'Teton',
    'Fremont', 'Park', 'Hot Springs',
  ], byNameState))

  // L28 WY counties (from fill_id_wy.js L28_WY array)
  assign(map, 28, listFips('56', [
    'Albany', 'Big Horn', 'Campbell', 'Carbon', 'Converse',
    'Crook', 'Goshen', 'Johnson', 'Laramie', 'Natrona',
    'Niobrara', 'Platte', 'Sheridan', 'Washakie', 'Weston',
  ], byNameState))

  // L82 ID panhandle (from fill_id_wy.js L82_ID array)
  assign(map, 82, listFips('16', [
    'Benewah', 'Bonner', 'Boundary', 'Clearwater', 'Idaho',
    'Kootenai', 'Latah', 'Lewis', 'Nez Perce', 'Shoshone',
  ], byNameState))

  return map
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function fetchCounties(): Promise<GeoFeatureCollection> {
  console.log('Downloading US counties GeoJSON...')
  const res = await fetch(COUNTIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.status} ${res.statusText}`)
  return res.json() as Promise<GeoFeatureCollection>
}

async function main() {
  const data = await fetchCounties()
  console.log(`Total US counties: ${data.features.length}`)

  const fipsToLocal = buildFipsToLocal(data)
  console.log(`FIPS→Local mapping entries: ${Object.keys(fipsToLocal).length}`)

  // Count per local
  const perLocal: Record<number, number> = {}
  for (const lid of Object.values(fipsToLocal)) {
    perLocal[lid] = (perLocal[lid] || 0) + 1
  }
  for (const lid of Object.keys(perLocal).sort((a, b) => Number(a) - Number(b))) {
    console.log(`  Local ${lid}: ${perLocal[Number(lid)]} counties`)
  }

  // Filter GeoJSON to only mapped counties and annotate with local properties
  const filtered: GeoFeature[] = []

  for (const feature of data.features) {
    const fips = String(feature.id).padStart(5, '0')
    const localNum = fipsToLocal[fips]
    if (localNum === undefined) continue

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
