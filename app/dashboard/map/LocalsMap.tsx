'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'
import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson'
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
  return '#9ca3af'
}

const BUILDING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`

export default function LocalsMap({ bids, selectedBidId, hoveredBidId, onBidHover, onBidClick }: LocalsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const branchMarkersRef = useRef<mapboxgl.Marker[]>([])
  const markerElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [territories, setTerritories] = useState<GeoFeatureCollection | null>(null)

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

      // Irex branch markers — add after map layers so they sit above territories
      IREX_BRANCHES.forEach((branch) => {
        const el = document.createElement('div')
        el.style.cssText = `
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #fff;
          border: 1.5px solid #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: default;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `
        el.innerHTML = BUILDING_SVG

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([branch.lng, branch.lat])
          .addTo(map)

        branchMarkersRef.current.push(marker)
      })
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      branchMarkersRef.current.forEach((m) => m.remove())
      branchMarkersRef.current = []
      markerElsRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Add/refresh bid markers whenever bids or territories change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    markerElsRef.current.clear()

    function placeMarkers() {
      for (const bid of bids) {
        const color = getBidColor(bid, territories)

        const el = document.createElement('div')
        el.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
        `

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([bid.longitude, bid.latitude])
          .addTo(map!)

        el.addEventListener('mouseenter', () => {
          // Remove previous popup
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }

          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 10,
          }).setHTML(
            `<div style="font-family: system-ui, sans-serif; font-size: 0.8125rem; font-weight: 600; color: #111; padding: 2px 4px; white-space: nowrap;">${bid.project_name}</div>`
          )

          marker.setPopup(popup)
          marker.togglePopup()
          popupRef.current = popup
          onBidHover(bid.id)
        })

        el.addEventListener('mouseleave', () => {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          onBidHover(null)
        })

        el.addEventListener('click', () => {
          onBidClick(bid.id)
        })

        markerElsRef.current.set(bid.id, el)
        markersRef.current.push(marker)
      }
    }

    if (map.isStyleLoaded()) {
      placeMarkers()
    } else {
      map.once('load', placeMarkers)
    }
  }, [bids, territories, onBidHover, onBidClick])

  // Update marker sizes when selectedBidId or hoveredBidId changes
  useEffect(() => {
    markerElsRef.current.forEach((el, id) => {
      const isActive = id === selectedBidId || id === hoveredBidId
      if (isActive) {
        const color = el.style.background
        el.style.cssText = `
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #fff;
          box-shadow: 0 0 0 4px ${color}66;
          cursor: pointer;
        `
      } else {
        const color = el.style.background
        el.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
        `
      }
    })
  }, [selectedBidId, hoveredBidId])

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
