'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FIPS_TO_LOCAL } from '@/lib/data/fips-map'
import { STATE_ABBR } from '@/lib/data/state-abbr'
import { Sidebar } from './Sidebar'
import type { DispatchPoint } from '@/lib/data/jurisdiction-calc'

/* ---------- GeoJSON (may not exist yet) ---------- */
let geojsonData: GeoJSON.FeatureCollection | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  geojsonData = require('@/lib/data/western-counties.geo.json') as GeoJSON.FeatureCollection
} catch {
  /* file missing — handled gracefully */
}

/* ---------- Types ---------- */
interface SelectedCounty {
  fips: string
  name: string
  state: string
  lat: number
  lng: number
  localId: number | null
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    hamlet?: string
    suburb?: string
    county?: string
    state?: string
  }
}

interface DispatchCity {
  name: string
  localId: number
  lat: number
  lng: number
}

interface ZoneRing {
  mi: number
  label: string
  color: string
}

/* ---------- Constants ---------- */
const LOCAL_COLORS: Record<number, string> = { 82: '#4a9eff', 7: '#3dd68c', 36: '#f5a623' }
const UNMAPPED_COLOR = '#d1d5db'
const MI_TO_M = 1609.34

const DISPATCH_CITIES: DispatchCity[] = [
  { name: 'Spokane', localId: 82, lat: 47.6588, lng: -117.426 },
  { name: 'Pasco', localId: 82, lat: 46.2396, lng: -119.1006 },
  { name: 'Seattle', localId: 7, lat: 47.6062, lng: -122.3321 },
  { name: 'Tacoma', localId: 7, lat: 47.2529, lng: -122.4443 },
  { name: 'Portland', localId: 36, lat: 45.5051, lng: -122.675 },
  { name: 'Medford', localId: 36, lat: 42.3265, lng: -122.8756 },
  { name: 'Hermiston', localId: 36, lat: 45.8401, lng: -119.2895 },
]

const ZONE_RINGS: Record<string, ZoneRing[]> = {
  '82': [
    { mi: 30, label: 'Zone 1–2 · Free', color: '#2ecc71' },
    { mi: 40, label: 'Zone 3 · $30/day', color: '#a8d840' },
    { mi: 50, label: 'Zone 4 · $40/day', color: '#f5c842' },
    { mi: 60, label: 'Zone 5 · $55/day', color: '#f09020' },
    { mi: 70, label: 'Zone 6 · $65/day', color: '#e06030' },
  ],
  '7s': [
    { mi: 20, label: 'Free Zone', color: '#2ecc71' },
    { mi: 70, label: 'Mileage → Per Diem 71+ mi', color: '#e84040' },
  ],
  '7a': [
    { mi: 20, label: 'Zone 1 · Free', color: '#2ecc71' },
    { mi: 30, label: 'Zone 2 · $20/day', color: '#90d840' },
    { mi: 40, label: 'Zone 3 · $30/day', color: '#f5c842' },
    { mi: 50, label: 'Zone 4 · $40/day', color: '#f09020' },
    { mi: 60, label: 'Zone 5 · $50/day', color: '#e07030' },
    { mi: 70, label: 'Zone 6 · $60/day', color: '#e04040' },
  ],
  '36': [
    { mi: 30, label: 'Zone 1 · Free', color: '#2ecc71' },
    { mi: 50, label: 'Zone 2 · $30/day', color: '#f5c842' },
    { mi: 70, label: 'Zone 3 · $65/day', color: '#f09020' },
    { mi: 100, label: 'Zone 4 · $85/day', color: '#e06030' },
  ],
}

/* Appendix A counties for Local 7 — Central WA work preservation */
const L7_APPENDIX_A_FALLBACK = new Set<string>(['53007', '53017', '53037', '53047', '53077'])

const DISPATCH_GROUPS: { label: string; cities: string[] }[] = [
  { label: 'Local 82', cities: ['Spokane', 'Pasco'] },
  { label: 'Local 7', cities: ['Seattle', 'Tacoma'] },
  { label: 'Local 36', cities: ['Portland', 'Medford', 'Hermiston'] },
]

/* ---------- Component ---------- */
export default function JurisdictionMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const pinRef = useRef<L.CircleMarker | null>(null)
  const countyLabelRef = useRef<L.Marker | null>(null)
  const ringGroupsRef = useRef<Map<string, L.LayerGroup>>(new Map())
  const selectedFipsRef = useRef<string | null>(null)

  const [selectedCounty, setSelectedCounty] = useState<SelectedCounty | null>(null)
  const [dispatchPoints, setDispatchPoints] = useState<Map<number, DispatchPoint[]>>(new Map())
  const [appendixACounties, setAppendixACounties] = useState<Set<string>>(new Set(L7_APPENDIX_A_FALLBACK))
  const [activeRings, setActiveRings] = useState<Set<string>>(new Set())

  /* Search state */
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---------- Fetch Supabase data ---------- */
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: dpData } = await supabase.from('dispatch_points').select('*')
      if (dpData) {
        const m = new Map<number, DispatchPoint[]>()
        for (const row of dpData) {
          const arr = m.get(row.local_id) ?? []
          arr.push({ name: row.name, lat: row.lat, lng: row.lng })
          m.set(row.local_id, arr)
        }
        setDispatchPoints(m)
      }

      const { data: aaData } = await supabase.from('appendix_a_counties').select('fips')
      if (aaData && aaData.length > 0) {
        setAppendixACounties(new Set(aaData.map((r: { fips: string }) => r.fips)))
      }
    }

    load()
  }, [])

  /* ---------- County selection ---------- */
  const selectCounty = useCallback((fips: string, countyName: string, state: string, lat: number, lng: number) => {
    const map = mapRef.current
    if (!map) return
    const localId = FIPS_TO_LOCAL[fips] ?? null
    const color = localId ? (LOCAL_COLORS[localId] ?? UNMAPPED_COLOR) : UNMAPPED_COLOR

    if (pinRef.current) map.removeLayer(pinRef.current)
    if (countyLabelRef.current) map.removeLayer(countyLabelRef.current)

    const pin = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: color,
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(map)
    pinRef.current = pin

    const labelHtml =
      `<div style="transform:translateX(-50%) translateY(-110%);pointer-events:none;text-align:center">` +
        `<div style="background:#1e293b;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.25);border-left:3px solid ${color}">` +
          `${countyName} <span style="font-size:10px;color:#94a3b8;font-weight:400">${state}</span>` +
        `</div>` +
        `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #1e293b;margin:0 auto"></div>` +
      `</div>`
    countyLabelRef.current = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: labelHtml, iconSize: [0, 0] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map)

    selectedFipsRef.current = fips
    setSelectedCounty({ fips, name: countyName, state, lat, lng, localId })
  }, [])

  /* ---------- Init map ---------- */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, { zoomControl: true })
    mapRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map)

    map.fitBounds([[38.5, -124.7], [49.0, -104.0]], { padding: [10, 10] })

    if (geojsonData) {
      const geoLayer = L.geoJSON(geojsonData, {
        style: (feature) => {
          const fips = String(feature?.id ?? '')
          const localId = FIPS_TO_LOCAL[fips]
          const fillColor = localId ? (LOCAL_COLORS[localId] ?? UNMAPPED_COLOR) : UNMAPPED_COLOR
          return { fillColor, fillOpacity: 0.45, weight: 1, color: '#fff' }
        },
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ fillOpacity: 0.7, weight: 2 })
          })
          layer.on('mouseout', () => {
            geoLayer.resetStyle(layer)
          })
          layer.on('click', (e: L.LeafletMouseEvent) => {
            const fips = String(feature.id ?? '')
            const countyName = (feature.properties as Record<string, string>)?.name ?? 'Unknown'
            const stateCode = Math.floor(Number(fips) / 1000)
            const state = STATE_ABBR[stateCode] ?? ''
            selectCounty(fips, countyName, state, e.latlng.lat, e.latlng.lng)
          })
        },
      }).addTo(map)
      geoLayerRef.current = geoLayer
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [selectCounty])

  /* ---------- Search ---------- */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=-124.8,49.1,-104.0,38.4&bounded=0`,
        )
        const data: NominatimResult[] = await res.json()
        setSearchResults(data)
        setShowResults(true)
      } catch {
        /* ignore */
      }
    }, 300)
  }, [])

  const flyToCoord = useCallback((lat: number, lng: number) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([lat, lng], 10, { duration: 1 })

    setTimeout(() => {
      const geoLayer = geoLayerRef.current
      if (!geoLayer) return
      const pt = L.latLng(lat, lng)
      let found = false
      geoLayer.eachLayer((layer) => {
        if (found) return
        try {
          const l = layer as L.Polygon & { feature?: GeoJSON.Feature }
          if (l.getBounds && l.getBounds().contains(pt)) {
            const feature = l.feature
            if (!feature) return
            const fips = String(feature.id ?? '')
            const countyName = (feature.properties as Record<string, string>)?.name ?? 'Unknown'
            const stateCode = Math.floor(Number(fips) / 1000)
            const state = STATE_ABBR[stateCode] ?? ''
            selectCounty(fips, countyName, state, lat, lng)
            found = true
          }
        } catch {
          /* ignore */
        }
      })
    }, 1100)
  }, [selectCounty])

  const handleSearchSelect = useCallback((r: NominatimResult) => {
    const a = r.address ?? {}
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || r.name || r.display_name.split(',')[0]
    setSearchQuery(city)
    setShowResults(false)
    flyToCoord(parseFloat(r.lat), parseFloat(r.lon))
  }, [flyToCoord])

  /* ---------- Dispatch rings ---------- */
  const toggleRings = useCallback((cityName: string) => {
    const map = mapRef.current
    if (!map) return

    const existing = ringGroupsRef.current.get(cityName)
    if (existing) {
      map.removeLayer(existing)
      ringGroupsRef.current.delete(cityName)
      setActiveRings(new Set(ringGroupsRef.current.keys()))
      return
    }

    const city = DISPATCH_CITIES.find((c) => c.name === cityName)
    if (!city) return

    const isAppendixA =
      city.localId === 7 &&
      selectedFipsRef.current !== null &&
      appendixACounties.has(selectedFipsRef.current)
    const ringKey = city.localId === 82 ? '82' : city.localId === 36 ? '36' : isAppendixA ? '7a' : '7s'
    const rings = ZONE_RINGS[ringKey]
    const lineColor = LOCAL_COLORS[city.localId] ?? '#4a7af5'

    const lg = L.layerGroup()

    ;[...rings].reverse().forEach((r) => {
      L.circle([city.lat, city.lng], {
        radius: r.mi * MI_TO_M,
        color: r.color,
        weight: 2.5,
        opacity: 0.9,
        fillColor: r.color,
        fillOpacity: 0.08,
        dashArray: '8 5',
      }).bindTooltip(`${r.label} — ${r.mi} mi radius`, { sticky: true }).addTo(lg)

      const parts = r.label.split('·')
      const zonePart = parts[0].trim()
      const costPart = parts.length > 1 ? parts[1].trim() : ''

      const labelHtml =
        `<div style="transform:translateX(-50%);white-space:nowrap;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">` +
          `<div style="background:${r.color};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:5px 5px 0 0;text-align:center;letter-spacing:.5px;text-shadow:0 1px 3px rgba(0,0,0,.4)">${zonePart}</div>` +
          (costPart
            ? `<div style="background:#1e293b;color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:0 0 5px 5px;text-align:center;border-top:1px solid rgba(255,255,255,.15);letter-spacing:.5px">${costPart}</div>`
            : '') +
          `<div style="width:2px;height:10px;background:${r.color};margin:0 auto;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>` +
        `</div>`

      L.marker([city.lat + r.mi / 69.0, city.lng], {
        icon: L.divIcon({ className: '', html: labelHtml, iconSize: [0, 0], iconAnchor: [0, 0] }),
        interactive: false,
      }).addTo(lg)
    })

    const dispHtml =
      `<div style="transform:translateX(-50%) translateY(-100%);text-align:center;pointer-events:none">` +
        `<div style="background:${lineColor};color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2);letter-spacing:.5px">${city.name}</div>` +
        `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${lineColor};margin:0 auto"></div>` +
      `</div>` +
      `<div style="width:14px;height:14px;background:${lineColor};border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px ${lineColor}cc;margin:-7px 0 0 -7px"></div>`
    L.marker([city.lat, city.lng], {
      icon: L.divIcon({ className: '', html: dispHtml, iconSize: [0, 0] }),
    }).bindTooltip(`<b>${city.name}</b> — dispatch point`).addTo(lg)

    lg.addTo(map)
    ringGroupsRef.current.set(cityName, lg)
    setActiveRings(new Set(ringGroupsRef.current.keys()))
  }, [appendixACounties])

  const clearAllRings = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    ringGroupsRef.current.forEach((lg) => map.removeLayer(lg))
    ringGroupsRef.current.clear()
    setActiveRings(new Set())
  }, [])

  /* ---------- Render ---------- */
  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-lg overflow-hidden border border-gray-200">
      <Sidebar
        selectedCounty={selectedCounty}
        dispatchPoints={dispatchPoints}
        appendixACounties={appendixACounties}
        onClose={() => {
          setSelectedCounty(null)
          selectedFipsRef.current = null
          if (pinRef.current && mapRef.current) {
            mapRef.current.removeLayer(pinRef.current)
            pinRef.current = null
          }
          if (countyLabelRef.current && mapRef.current) {
            mapRef.current.removeLayer(countyLabelRef.current)
            countyLabelRef.current = null
          }
        }}
      />

      {/* Map panel */}
      <div className="relative flex-1 min-w-0">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Search bar — top center */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowResults(false)
                ;(e.target as HTMLInputElement).blur()
              } else if (e.key === 'Enter' && searchResults[0]) {
                handleSearchSelect(searchResults[0])
              }
            }}
            placeholder="Search city, county, or address…"
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
          {showResults && searchResults.length > 0 && (
            <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {searchResults.map((r, i) => {
                const a = r.address ?? {}
                const city = a.city || a.town || a.village || a.hamlet || a.suburb || r.name || r.display_name.split(',')[0]
                const county = (a.county ?? '').replace(' County', '')
                const state = a.state ?? ''
                return (
                  <button
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSearchSelect(r)
                    }}
                    className="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-blue-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-xs text-gray-900">{city}</span>
                    <span className="text-[10px] text-gray-400 ml-2">
                      {county && `${county} Co · `}
                      {state}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Dispatch ring buttons — bottom */}
        <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-2">
          {DISPATCH_GROUPS.map((group) => {
            const firstCity = DISPATCH_CITIES.find((c) => c.name === group.cities[0])
            const groupColor = firstCity ? LOCAL_COLORS[firstCity.localId] : '#4a7af5'
            return (
              <div key={group.label} className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: groupColor }}
                >
                  {group.label}:
                </span>
                {group.cities.map((city) => {
                  const active = activeRings.has(city)
                  return (
                    <button
                      key={city}
                      onClick={() => toggleRings(city)}
                      className="px-2.5 py-1 text-[11px] font-medium border rounded transition-colors"
                      style={{
                        background: active ? groupColor : 'transparent',
                        borderColor: active ? groupColor : `${groupColor}55`,
                        color: active ? '#fff' : groupColor,
                      }}
                    >
                      {city}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <button
            onClick={clearAllRings}
            disabled={activeRings.size === 0}
            className="ml-auto px-2.5 py-1 text-[11px] font-medium border border-gray-300 rounded text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-gray-300 disabled:hover:text-gray-500"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}
