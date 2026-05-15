'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'
import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson'
import { LOCALS, type LocalNumber } from '@/config/locals'
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
}

function formatCurrency(value: number | null): string {
  if (value == null) return 'TBD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getBidColor(
  bid: MapBid,
  territories: GeoFeatureCollection | null,
): string {
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
  return '#9ca3af' // no local — gray pin
}

export default function LocalsMap({ bids }: LocalsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [territories, setTerritories] = useState<GeoFeatureCollection | null>(null)

  // Fetch the territory GeoJSON once so we can do point-in-polygon for marker colors
  useEffect(() => {
    fetch('/locals-territories.geojson')
      .then((r) => r.json() as Promise<GeoFeatureCollection>)
      .then(setTerritories)
      .catch((err: unknown) => console.warn('[LocalsMap] Failed to load territories:', err))
  }, [])

  // Build map once
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

    map.on('load', () => {
      // ── County territory fills ─────────────────────────────────────────────
      map.addSource('locals', {
        type: 'geojson',
        data: '/locals-territories.geojson',
      })

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

      // ── Local number labels — one label per local at its center ────────────
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
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Add/refresh markers whenever bids or territories change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    function placeMarkers() {
      for (const bid of bids) {
        const color = getBidColor(bid, territories)
        const noLocal = color === '#9ca3af'

        const el = document.createElement('div')
        el.style.cssText = `
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          cursor: pointer;
        `

        const localLabel = noLocal ? 'No local' : getLocalName(color)

        const popup = new mapboxgl.Popup({
          closeOnClick: false,
          closeOnMove: false,
          offset: 10,
          maxWidth: '280px',
        }).setHTML(`
          <div style="font-family: system-ui, sans-serif; padding: 4px 2px;">
            <p style="margin: 0 0 4px; font-weight: 600; font-size: 0.875rem; color: #111;">${escHtml(bid.project_name)}</p>
            <p style="margin: 0 0 2px; font-size: 0.75rem; color: #555;">Branch: ${escHtml(bid.branch)}</p>
            <p style="margin: 0 0 2px; font-size: 0.75rem; color: #555;">Status: ${escHtml(bid.status)}</p>
            <p style="margin: 0 0 2px; font-size: 0.75rem; color: #555;">Bid Value: ${formatCurrency(bid.total_price)}</p>
            ${noLocal ? `<p style="margin: 0 0 8px; font-size: 0.75rem; color: #999;">No local</p>` : `<p style="margin: 0 0 8px; font-size: 0.75rem; color: #555;">${escHtml(localLabel)}</p>`}
            <a href="/dashboard/bids/${bid.id}" style="display: inline-block; font-size: 0.75rem; font-weight: 600; color: #2563eb; text-decoration: none;">Open bid →</a>
          </div>
        `)

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([bid.longitude, bid.latitude])
          .setPopup(popup)
          .addTo(map!)

        el.addEventListener('click', () => {
          marker.togglePopup()
        })

        markersRef.current.push(marker)
      }
    }

    if (map.isStyleLoaded()) {
      placeMarkers()
    } else {
      map.once('load', placeMarkers)
    }
  }, [bids, territories])

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

function getLocalName(color: string): string {
  const localNumbers: LocalNumber[] = [7, 16, 28, 36, 69, 73, 76, 82, 135]
  for (const num of localNumbers) {
    if (LOCALS[num].color === color) return LOCALS[num].name
  }
  return ''
}
