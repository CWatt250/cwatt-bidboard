'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Point,
  Polygon,
  MultiPolygon,
} from 'geojson'
import { LOCALS, type LocalNumber } from '@/config/locals'
import { IREX_BRANCHES } from '@/config/irex-branches'
import type { MapBid } from './MapPageClient'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

interface GeoFeature {
  type: 'Feature'
  properties: {
    local_color: string
    local_number: number
    local_name: string
    [key: string]: unknown
  }
  geometry: Geometry
}

interface GeoFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

interface LocalsMapProps {
  bids: MapBid[]
  selectedBidId: string | null
  hoveredBidId: string | null
  onBidHover: (id: string | null) => void
  onBidClick: (id: string) => void
}

function getBidColor(bid: MapBid, territories: GeoFeatureCollection | null): string {
  if (!territories) return '#9ca3af'
  const pt = turf.point([bid.longitude, bid.latitude])
  for (const feature of territories.features) {
    try {
      if (turf.booleanPointInPolygon(pt, feature as Feature<Polygon | MultiPolygon>)) {
        return feature.properties.local_color
      }
    } catch {
      // skip malformed features
    }
  }
  return '#9ca3af'
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Formatted bid value — a dollar amount, or "TBD" when no prices are entered. */
function formatBidValue(total: number | null): string {
  return total == null ? 'TBD' : currencyFmt.format(total)
}

/** Minimal HTML escaping for values interpolated into popup markup. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** GeoJSON FeatureCollection for the Awarded/Verbal bid pins. */
function buildBidFeatures(
  bids: MapBid[],
  territories: GeoFeatureCollection | null,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: bids.map((bid) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [bid.longitude, bid.latitude] },
      properties: {
        id: bid.id,
        name: bid.project_name,
        color: getBidColor(bid, territories),
        status: bid.status,
        value: formatBidValue(bid.total_price),
        branch: bid.branch,
      },
    })),
  }
}

const EMPTY_FC: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

/** Static GeoJSON for the Irex branch points. */
const IREX_FC: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: IREX_BRANCHES.map((branch) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [branch.lng, branch.lat] },
    properties: {
      id: branch.id,
      label: branch.city.toUpperCase(),
      fullName: `${branch.city} Branch`,
      location: `${branch.city}, ${branch.state}`,
    },
  })),
}

export default function LocalsMap({
  bids,
  selectedBidId,
  hoveredBidId,
  onBidHover,
  onBidClick,
}: LocalsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [territories, setTerritories] = useState<GeoFeatureCollection | null>(null)
  const [layersReady, setLayersReady] = useState(false)

  // Keep the latest callbacks reachable from map event handlers that are
  // registered once — avoids stale closures without re-binding listeners.
  const callbacksRef = useRef({ onBidHover, onBidClick })
  callbacksRef.current = { onBidHover, onBidClick }

  // Load territory polygons (used to color the bid pins)
  useEffect(() => {
    fetch('/locals-territories.geojson')
      .then((r) => r.json() as Promise<GeoFeatureCollection>)
      .then(setTerritories)
      .catch((err: unknown) => console.warn('[LocalsMap] Failed to load territories:', err))
  }, [])

  // Build the map once
  useEffect(() => {
    if (!containerRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-115, 40],
      zoom: 5.5,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // One popup instance, reused for every bid and Irex hover.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: 'bidwatt-popup',
    })
    popupRef.current = popup

    map.on('load', () => {
      // --- Territory fills + borders ---
      map.addSource('locals', { type: 'geojson', data: '/locals-territories.geojson' })

      map.addLayer({
        id: 'locals-fill',
        type: 'fill',
        source: 'locals',
        paint: {
          'fill-color': ['get', 'local_color'],
          'fill-opacity': 0.35,
        },
      })

      map.addLayer({
        id: 'locals-border',
        type: 'line',
        source: 'locals',
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.6,
          'line-width': 1,
        },
      })

      // --- Territory labels ---
      const localNumbers: LocalNumber[] = [7, 16, 28, 36, 69, 73, 76, 82, 135]
      localNumbers.forEach((num) => {
        const local = LOCALS[num]
        const [lat, lng] = local.center

        map.addSource(`label-local-${num}`, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lng, lat] },
                properties: { label: `LOCAL ${num}` },
              },
            ],
          },
        })

        map.addLayer({
          id: `label-layer-${num}`,
          type: 'symbol',
          source: `label-local-${num}`,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
          },
        })
      })

      // --- Bid pins: source + circle + label layers ---
      // promoteId lets setFeatureState key off properties.id for hover scaling.
      map.addSource('bid-points', { type: 'geojson', data: EMPTY_FC, promoteId: 'id' })

      map.addLayer({
        id: 'bid-circles',
        type: 'circle',
        source: 'bid-points',
        paint: {
          // 10px normally, 15px while the feature-state `hover` flag is set.
          'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 15, 10],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 1,
        },
      })

      map.addLayer({
        id: 'bid-labels',
        type: 'symbol',
        source: 'bid-points',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-max-width': 12,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1a1a2e',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      })

      // --- Irex branches: source + circle + label layers (always on top) ---
      map.addSource('irex-points', { type: 'geojson', data: IREX_FC })

      map.addLayer({
        id: 'irex-circles',
        type: 'circle',
        source: 'irex-points',
        paint: {
          'circle-radius': 8,
          'circle-color': '#0f2340',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.addLayer({
        id: 'irex-labels',
        type: 'symbol',
        source: 'irex-points',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-letter-spacing': 0.05,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0f2340',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      })

      // --- Bid hover/click — map-level layer events (no DOM-marker flicker) ---
      map.on('mouseenter', 'bid-circles', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties ?? {}
        map.getCanvas().style.cursor = 'pointer'
        const coords: mapboxgl.LngLatLike =
          feature.geometry.type === 'Point'
            ? (feature.geometry.coordinates as [number, number])
            : e.lngLat
        popup
          .setLngLat(coords)
          .setHTML(
            `<strong>${escapeHtml(props.name)}</strong><br>` +
              `${escapeHtml(props.branch)} · ${escapeHtml(props.status)}<br>` +
              `${escapeHtml(props.value)}`,
          )
          .addTo(map)
        if (props.id) callbacksRef.current.onBidHover(String(props.id))
      })

      map.on('mouseleave', 'bid-circles', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
        callbacksRef.current.onBidHover(null)
      })

      map.on('click', 'bid-circles', (e) => {
        const props = e.features?.[0]?.properties
        if (props?.id) callbacksRef.current.onBidClick(String(props.id))
      })

      // --- Irex hover ---
      map.on('mouseenter', 'irex-circles', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties ?? {}
        map.getCanvas().style.cursor = 'pointer'
        const coords: mapboxgl.LngLatLike =
          feature.geometry.type === 'Point'
            ? (feature.geometry.coordinates as [number, number])
            : e.lngLat
        popup
          .setLngLat(coords)
          .setHTML(
            `<strong>${escapeHtml(props.fullName)}</strong><br>${escapeHtml(props.location)}`,
          )
          .addTo(map)
      })

      map.on('mouseleave', 'irex-circles', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      setLayersReady(true)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      setLayersReady(false)
    }
  }, [])

  // Refresh the bid source whenever bids load or territory colors resolve
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReady) return
    const source = map.getSource('bid-points') as mapboxgl.GeoJSONSource | undefined
    source?.setData(buildBidFeatures(bids, territories))
  }, [bids, territories, layersReady])

  // Sync hovered/selected bid → enlarged circle via feature-state
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReady) return
    map.removeFeatureState({ source: 'bid-points' })
    for (const id of [hoveredBidId, selectedBidId]) {
      if (id) map.setFeatureState({ source: 'bid-points', id }, { hover: true })
    }
  }, [hoveredBidId, selectedBidId, layersReady, bids])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 'calc(100dvh - 120px)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    />
  )
}
