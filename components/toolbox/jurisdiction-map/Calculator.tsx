'use client'

import { useState, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  nearest,
  c82,
  c7,
  c7a,
  c36,
  type DispatchPoint,
  type ZoneResult,
} from '@/lib/data/jurisdiction-calc'

const LOCAL_IDS = [82, 7, 36] as const
type LocalId = (typeof LOCAL_IDS)[number]

const LOCAL_COLORS: Record<LocalId, string> = {
  82: '#2563eb',
  7: '#16a34a',
  36: '#dc2626',
}

interface CalculatorProps {
  selectedCounty: {
    fips: string
    name: string
    lat: number
    lng: number
    localId: number | null
  }
  dispatchPoints: Record<number, DispatchPoint[]>
  appendixACounties: Set<string>
}

function resolveLocal(localId: number | null): LocalId {
  return (LOCAL_IDS.includes(localId as LocalId) ? localId : 82) as LocalId
}

export default function Calculator({
  selectedCounty,
  dispatchPoints,
  appendixACounties,
}: CalculatorProps) {
  const [activeLocal, setActiveLocal] = useState<LocalId>(() =>
    resolveLocal(selectedCounty.localId)
  )
  const [milesOverride, setMilesOverride] = useState<string>('')
  const [companyVehicle, setCompanyVehicle] = useState(false)

  useEffect(() => {
    setActiveLocal(resolveLocal(selectedCounty.localId))
    setMilesOverride('')
    setCompanyVehicle(false)
  }, [selectedCounty.fips, selectedCounty.localId])

  const isAppendixA = appendixACounties.has(selectedCounty.fips)

  const nearestDispatch = useMemo(() => {
    const pts = dispatchPoints[activeLocal]
    if (!pts || pts.length === 0) return null
    return nearest(selectedCounty.lat, selectedCounty.lng, pts)
  }, [selectedCounty.lat, selectedCounty.lng, activeLocal, dispatchPoints])

  const miles =
    milesOverride !== '' ? Number(milesOverride) : (nearestDispatch?.d ?? 0)

  const result: ZoneResult = useMemo(() => {
    if (activeLocal === 82) return c82(miles)
    if (activeLocal === 7) return isAppendixA ? c7a(miles) : c7(miles)
    return c36(miles, companyVehicle)
  }, [activeLocal, miles, companyVehicle, isAppendixA])

  const isOverride =
    selectedCounty.localId !== null && activeLocal !== selectedCounty.localId

  return (
    <div className="space-y-3">
      {/* Local selector pills */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Local
        </Label>
        <div className="flex gap-1.5">
          {LOCAL_IDS.map((id) => {
            const isActive = activeLocal === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveLocal(id)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: LOCAL_COLORS[id],
                        color: '#fff',
                      }
                    : {
                        border: '1px solid #d1d5db',
                        color: '#6b7280',
                        backgroundColor: 'transparent',
                      }
                }
              >
                Local {id}
              </button>
            )
          })}
        </div>
      </div>

      {/* Override warning */}
      {isOverride && (
        <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
          This county is normally Local {selectedCounty.localId}. You are
          viewing Local {activeLocal} rates.
        </div>
      )}

      {/* Appendix A tag (Local 7 only) */}
      {activeLocal === 7 && isAppendixA && (
        <div className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Appendix A — Central WA
        </div>
      )}

      {/* Nearest dispatch city */}
      {nearestDispatch && (
        <p className="text-xs text-muted-foreground">
          Nearest:{' '}
          <span className="font-medium text-foreground">
            {nearestDispatch.p.name}
          </span>{' '}
          — {nearestDispatch.d} mi
        </p>
      )}

      {/* Miles input */}
      <div>
        <Label htmlFor="miles-input" className="text-xs text-muted-foreground">
          Miles from dispatch
        </Label>
        <Input
          id="miles-input"
          type="number"
          min={0}
          max={999}
          placeholder={String(nearestDispatch?.d ?? 0)}
          value={milesOverride}
          onChange={(e) => setMilesOverride(e.target.value)}
          className="mt-1 w-28"
        />
      </div>

      {/* Vehicle toggle (Local 36 only) */}
      {activeLocal === 36 && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Vehicle
          </Label>
          <div className="flex gap-1.5">
            {[false, true].map((cv) => (
              <button
                key={String(cv)}
                type="button"
                onClick={() => setCompanyVehicle(cv)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  companyVehicle === cv
                    ? 'bg-foreground text-background'
                    : 'border border-gray-300 text-gray-500'
                }`}
              >
                {cv ? 'Company vehicle' : 'Personal vehicle'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cost output */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">
          {result.z}
        </p>
        <p
          className={`text-2xl font-medium ${
            result.c === 0 ? 'text-green-600' : 'text-orange-600'
          }`}
        >
          ${result.c.toFixed(2)}
          <span className="text-xs font-normal text-muted-foreground ml-1">
            / day
          </span>
        </p>
        {result.n && (
          <p className="text-xs text-muted-foreground">{result.n}</p>
        )}
        {result.alt !== undefined && (
          <p className="text-xs text-muted-foreground">
            Alt daily rate: ${result.alt.toFixed(2)}/day
          </p>
        )}
        <div className="flex gap-4 pt-1 border-t border-border mt-2">
          <div>
            <p className="text-xs text-muted-foreground">5-day week</p>
            <p className="text-sm font-medium">
              ${(result.c * 5).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">6-day week</p>
            <p className="text-sm font-medium">
              ${(result.c * 6).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
