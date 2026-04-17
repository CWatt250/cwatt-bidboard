'use client'

import { useState, useEffect, useMemo } from 'react'
import { nearest, c82, c7, c7a, c36 } from '@/lib/data/jurisdiction-calc'
import type { DispatchPoint, ZoneResult } from '@/lib/data/jurisdiction-calc'

interface SelectedCounty {
  fips: string
  name: string
  state: string
  lat: number
  lng: number
  localId: number | null
}

interface CalculatorProps {
  selectedCounty: SelectedCounty
  dispatchPoints: Map<number, DispatchPoint[]>
  appendixACounties: Set<string>
}

const LOCAL_OPTIONS = [
  { id: 82, label: 'Local 82', color: '#4a9eff' },
  { id: 7, label: 'Local 7', color: '#3dd68c' },
  { id: 36, label: 'Local 36', color: '#f5a623' },
]

export function Calculator({ selectedCounty, dispatchPoints, appendixACounties }: CalculatorProps) {
  const [selectedLocal, setSelectedLocal] = useState<number>(selectedCounty.localId ?? 82)
  const [miles, setMiles] = useState<number>(0)
  const [companyVehicle, setCompanyVehicle] = useState(false)

  const allPoints = useMemo(() => {
    const pts: DispatchPoint[] = []
    dispatchPoints.forEach((arr) => pts.push(...arr))
    return pts
  }, [dispatchPoints])

  const nearestDispatch = useMemo(() => {
    if (allPoints.length === 0) return null
    return nearest(selectedCounty.lat, selectedCounty.lng, allPoints)
  }, [selectedCounty.lat, selectedCounty.lng, allPoints])

  useEffect(() => {
    setSelectedLocal(selectedCounty.localId ?? 82)
    if (nearestDispatch) {
      setMiles(nearestDispatch.d)
    }
    setCompanyVehicle(false)
  }, [selectedCounty, nearestDispatch])

  const isAppendixA = selectedLocal === 7 && appendixACounties.has(selectedCounty.fips)

  const result: ZoneResult = useMemo(() => {
    switch (selectedLocal) {
      case 82: return c82(miles)
      case 7: return isAppendixA ? c7a(miles) : c7(miles)
      case 36: return c36(miles, companyVehicle)
      default: return c82(miles)
    }
  }, [selectedLocal, miles, companyVehicle, isAppendixA])

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Travel Calculator</h4>

      {/* Local selector pills */}
      <div className="flex gap-1">
        {LOCAL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelectedLocal(opt.id)}
            className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
            style={{
              backgroundColor: selectedLocal === opt.id ? opt.color : '#f3f4f6',
              color: selectedLocal === opt.id ? '#fff' : '#6b7280',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Override warning */}
      {selectedCounty.localId && selectedLocal !== selectedCounty.localId && (
        <p className="text-xs text-orange-600 font-medium">
          This county is normally Local {selectedCounty.localId}
        </p>
      )}

      {/* Nearest dispatch */}
      {nearestDispatch && (
        <p className="text-xs text-gray-500">
          Nearest: <span className="font-medium text-gray-700">{nearestDispatch.p.name}</span> — {nearestDispatch.d} mi
        </p>
      )}

      {/* Miles input */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Miles from dispatch</label>
        <input
          type="number"
          min={0}
          value={miles}
          onChange={(e) => setMiles(Number(e.target.value) || 0)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Vehicle toggle for Local 36 */}
      {selectedLocal === 36 && (
        <div className="flex gap-1">
          <button
            onClick={() => setCompanyVehicle(false)}
            className={`px-3 py-1 text-xs rounded-full font-medium ${!companyVehicle ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            Personal
          </button>
          <button
            onClick={() => setCompanyVehicle(true)}
            className={`px-3 py-1 text-xs rounded-full font-medium ${companyVehicle ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            Company
          </button>
        </div>
      )}

      {/* Appendix A tag */}
      {isAppendixA && (
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
          Appendix A County
        </span>
      )}

      {/* Cost output */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{result.z}</p>
        <p className={`text-2xl font-semibold ${result.c === 0 ? 'text-green-600' : 'text-orange-600'}`}>
          ${result.c.toFixed(2)}<span className="text-xs font-normal text-gray-400 ml-1">/day</span>
        </p>
        {result.n && <p className="text-xs text-gray-500">{result.n}</p>}
        {result.alt !== undefined && (
          <p className="text-xs text-gray-500">Alt rate: ${result.alt}/day</p>
        )}
        <div className="border-t border-gray-200 pt-2 mt-2 flex gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase">5-Day Total</p>
            <p className="text-sm font-semibold text-gray-700">${(result.c * 5).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase">6-Day Total</p>
            <p className="text-sm font-semibold text-gray-700">${(result.c * 6).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
