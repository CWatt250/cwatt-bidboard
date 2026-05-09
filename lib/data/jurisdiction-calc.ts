export interface ZoneResult {
  z: string; c: number; n?: string; alt?: number
}
export interface DispatchPoint {
  name: string; lat: number; lng: number
}
export interface NearestResult {
  p: DispatchPoint; d: number
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, r = Math.PI / 180
  const dl = (lat2 - lat1) * r, dn = (lng2 - lng1) * r
  const x = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dn / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function nearest(lat: number, lng: number, pts: DispatchPoint[]): NearestResult {
  let bp = pts[0], bd = Infinity
  pts.forEach(p => {
    const d = haversine(lat, lng, p.lat, p.lng)
    if (d < bd) { bd = d; bp = p }
  })
  return { p: bp, d: Math.round(bd) }
}

export function c82(m: number): ZoneResult {
  if (m <= 30) return { z: 'Zone 1–2 — Free', c: 0, n: 'No travel pay' }
  if (m <= 40) return { z: 'Zone 3', c: 30 }
  if (m <= 50) return { z: 'Zone 4', c: 40 }
  if (m <= 60) return { z: 'Zone 5', c: 55 }
  if (m <= 70) return { z: 'Zone 6', c: 65 }
  return { z: 'Zone 6+ — Subsistence', c: 140, n: 'Includes $35/day meals' }
}

export function c7(m: number): ZoneResult {
  if (m <= 20) return { z: 'Free Zone', c: 0, n: 'Within 20 mi of city limits' }
  if (m <= 70) {
    const p = m - 20, v = +(0.67 * 2 * p).toFixed(2)
    return { z: 'Mileage Zone', c: v, n: `$0.67 × ${p} mi × 2 (round-trip from free zone edge)` }
  }
  return { z: 'Per Diem Zone', c: 150, n: '$150/day — all workers regardless of transport' }
}

export function c7a(m: number): ZoneResult {
  if (m <= 20) return { z: 'Zone 1 — Free', c: 0, n: 'No travel pay' }
  if (m <= 30) return { z: 'Zone 2', c: 20 }
  if (m <= 40) return { z: 'Zone 3', c: 30 }
  if (m <= 50) return { z: 'Zone 4', c: 40 }
  if (m <= 60) return { z: 'Zone 5', c: 50 }
  if (m <= 70) return { z: 'Zone 6', c: 60 }
  return { z: 'Zone 7 — Per Diem', c: 150 }
}

export function c36(m: number, cv: boolean): ZoneResult {
  if (m <= 30) return { z: 'Zone 1 — Free', c: 0, n: 'No travel pay' }
  if (m <= 50) return { z: 'Zone 2', c: cv ? 19 : 30, n: cv ? 'Co. vehicle rate (verify current)' : '' }
  if (m <= 70) return { z: 'Zone 3', c: cv ? 29 : 65, n: cv ? 'Co. vehicle rate (verify current)' : '' }
  if (m <= 100) return { z: 'Zone 4', c: cv ? 43 : 85, n: cv ? 'Co. vehicle rate (verify current)' : '' }
  const alt = cv ? 75 : 90
  return { z: 'Zone 5', c: cv ? 135 : 160, alt, n: cv ? '$135/day stay overnight — or $75/day if driven daily' : '$160/day stay overnight — or $90/day drive-only' }
}
