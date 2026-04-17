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

/* ---------- Constants ---------- */
const LOCAL_COLORS: Record<number, string> = { 82: '#4a9eff', 7: '#3dd68c', 36: '#f5a623' }
const UNMAPPED_COLOR = '#d1d5db'

const DISPATCH_CITIES: { name: string; localId: number; lat: number; lng: number }[] = [
  { name: 'Spokane', localId: 82, lat: 47.6588, lng: -117.426 },
  { name: 'Pasco', localId: 82, lat: 46.2396, lng: -119.1006 },
  { name: 'Seattle', localId: 7, lat: 47.6062, lng: -122.3321 },
  { name: 'Tacoma', localId: 7, lat: 47.2529, lng: -122.4443 },
  { name: 'Portland', localId: 36, lat: 45.5051, lng: -122.675 },
  { name: 'Medford', localId: 36, lat: 42.3265, lng: -122.8756 },
  { name: 'Hermiston', localId: 36, lat: 45.8401, lng: -119.2895 },
]

const RING_DEFS: Record<number, { miles: number[]; colors: string[] }> = {
  82: { miles: [30, 40, 50, 60, 70], colors: ['#2ecc71', '#a8d840', '#f5c842', '#f09020', '#e06030'] },
  7: { miles: [20, 70], colors: ['#2ecc71', '#e84040'] },
  36: { miles: [30, 50, 70, 100], colors: ['#2ecc71', '#f5c842', '#f09020', '#e06030'] },
}

const DISPATCH_GROUPS: { label: string; cities: string[] }[] = [
  { label: 'L82', cities: ['Spokane', 'Pasco'] },
  { label: 'L7', cities: ['Seattle', 'Tacoma'] },
  { label: 'L36', cities: ['Portland', 'Medford', 'Hermiston'] },
]

/* ---------- Component ---------- */
export default function JurisdictionMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const pinRef = useRef<L.CircleMarker | null>(null)
  const ringLayersRef = useRef<L.LayerGroup>(L.layerGroup())
  const tooltipRef = useRef<L.Popup | null>(null)

  const [selectedCounty, setSelectedCounty] = useState<SelectedCounty | null>(null)
  const [dispatchPoints, setDispatchPoints] = useState<Map<number, DispatchPoint[]>>(new Map())
  const [appendixACounties, setAppendixACounties] = useState<Set<string>>(new Set())

  /* Search state */
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---------- Fetch Supabase data ---------- */
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      /* dispatch_points */
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

      /* appendix_a_counties */
      const { data: aaData } = await supabase.from('appendix_a_counties').select('fips')
      if (aaData) {
        setAppendixACounties(new Set(aaData.map((r: { fips: string }) => r.fips)))
      }
    }

    load()
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

    ringLayersRef.current.addTo(map)

    /* GeoJSON */
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
            handleCountyClick(feature, e.latlng)
          })
        },
      }).addTo(map)
      geoLayerRef.current = geoLayer
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- County click ---------- */
  const handleCountyClick = useCallback((feature: GeoJSON.Feature, latlng: L.LatLng) => {
    const map = mapRef.current
    if (!map) return

    const fips = String(feature.id ?? '')
    const localId = FIPS_TO_LOCAL[fips] ?? null
    const countyName = (feature.properties as Record<string, string>)?.name ?? 'Unknown'
    const stateCode = Math.floor(Number(fips) / 1000)
    const state = STATE_ABBR[stateCode] ?? ''
    const color = localId ? (LOCAL_COLORS[localId] ?? UNMAPPED_COLOR) : UNMAPPED_COLOR

    /* Remove old pin */
    if (pinRef.current) {
      map.removeLayer(pinRef.current)
    }
    if (tooltipRef.current) {
      map.removeLayer(tooltipRef.current)
    }

    /* New pin */
    const pin = L.circleMarker(latlng, {
      radius: 8,
      fillColor: color,
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(map)
    pinRef.current = pin

    /* Label popup */
    const popup = L.popup({ closeButton: false, className: 'county-label-popup', offset: [0, -12] })
      .setLatLng(latlng)
      .setContent(`<strong>${countyName}</strong>, ${state}`)
      .openOn(map)
    tooltipRef.current = popup

    setSelectedCounty({
      fips,
      name: countyName,
      state,
      lat: latlng.lat,
      lng: latlng.lng,
      localId,
    })
  }, [])

  /* ---------- Search ---------- */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&countrycodes=us&viewbox=-124.8,49.1,-104.0,38.4&bounded=0`,
          { headers: { 'User-Agent': 'HFIAW-WesternEstimator/1.0' } }
        )
        const data = await res.json()
        setSearchResults(data)
        setShowResults(true)
      } catch {
        /* ignore search errors */
      }
    }, 300)
  }, [])

  const handleSearchSelect = useCallback((lat: string, lon: string) => {
    mapRef.current?.flyTo([parseFloat(lat), parseFloat(lon)], 10)
    setShowResults(false)
    setSearchQuery('')
  }, [])

  /* ---------- Dispatch rings ---------- */
  const drawRings = useCallback((cityName: string) => {
    const map = mapRef.current
    if (!map) return

    ringLayersRef.current.clearLayers()

    const city = DISPATCH_CITIES.find((c) => c.name === cityName)
    if (!city) return

    const def = RING_DEFS[city.localId]
    if (!def) return

    def.miles.forEach((mi, i) => {
      const circle = L.circle([city.lat, city.lng], {
        radius: mi * 1609.34,
        dashArray: '8 5',
        weight: 2.5,
        opacity: 0.9,
        fillOpacity: 0.08,
        color: def.colors[i],
        fillColor: def.colors[i],
      })
      ringLayersRef.current.addLayer(circle)

      /* Label pill at north edge */
      const labelLat = city.lat + mi / 69.0
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${def.colors[i]};color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:9999px;white-space:nowrap;text-align:center;">${mi} mi</div>`,
        iconSize: [0, 0],
        iconAnchor: [20, 8],
      })
      const label = L.marker([labelLat, city.lng], { icon, interactive: false })
      ringLayersRef.current.addLayer(label)
    })

    map.flyTo([city.lat, city.lng], 8)
  }, [])

  const clearRings = useCallback(() => {
    ringLayersRef.current.clearLayers()
  }, [])

  /* ---------- Render ---------- */
  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-lg overflow-hidden border border-gray-200">
      {/* Sidebar */}
      <Sidebar
        selectedCounty={selectedCounty}
        dispatchPoints={dispatchPoints}
        appendixACounties={appendixACounties}
        onClose={() => {
          setSelectedCounty(null)
          if (pinRef.current && mapRef.current) {
            mapRef.current.removeLayer(pinRef.current)
            pinRef.current = null
          }
          if (tooltipRef.current && mapRef.current) {
            mapRef.current.removeLayer(tooltipRef.current)
            tooltipRef.current = null
          }
        }}
      />

      {/* Map panel */}
      <div className="relative flex-1 min-w-0">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Search bar */}
        <div className="absolute top-3 right-3 z-30 w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search location..."
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {showResults && searchResults.length > 0 && (
            <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onMouseDown={() => handleSearchSelect(r.lat, r.lon)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dispatch zone ring buttons */}
        <div className="absolute top-14 right-3 z-30 flex flex-col gap-1">
          {DISPATCH_GROUPS.map((group) => (
            <div key={group.label} className="flex gap-1">
              {group.cities.map((city) => (
                <button
                  key={city}
                  onClick={() => drawRings(city)}
                  className="px-2 py-1 text-[10px] font-medium bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors"
                >
                  {city}
                </button>
              ))}
            </div>
          ))}
          <button
            onClick={clearRings}
            className="px-2 py-1 text-[10px] font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50 text-red-500 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
