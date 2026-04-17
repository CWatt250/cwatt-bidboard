'use client'

import { X } from 'lucide-react'
import { Calculator } from './Calculator'
import type { DispatchPoint } from '@/lib/data/jurisdiction-calc'

interface SelectedCounty {
  fips: string
  name: string
  state: string
  lat: number
  lng: number
  localId: number | null
}

interface LocalInfo {
  id: number
  name: string
  color: string
  bm: string
  address: string
  phone: string
  cba: string
  jurisdiction: string
}

interface SidebarProps {
  selectedCounty: SelectedCounty
  dispatchPoints: Map<number, DispatchPoint[]>
  appendixACounties: Set<string>
  onClose: () => void
}

const LOCAL_DATA: Record<number, LocalInfo> = {
  82: {
    id: 82,
    name: 'Local 82',
    color: '#4a9eff',
    bm: 'Rory Homes',
    address: '4002 E Broadway Ave, Spokane, WA',
    phone: '(509) 534-1590',
    cba: '8/1/2023 – 7/31/2027',
    jurisdiction: 'Eastern Washington, Northern Idaho, all of Montana',
  },
  7: {
    id: 7,
    name: 'Local 7',
    color: '#3dd68c',
    bm: 'Todd Mitchell',
    address: '14675 Interurban Ave S, Tukwila, WA',
    phone: '(206) 812-0777',
    cba: '6/1/2024 – 5/31/2030',
    jurisdiction: 'Western Washington',
  },
  36: {
    id: 36,
    name: 'Local 36',
    color: '#f5a623',
    bm: 'TBD',
    address: 'Portland, OR',
    phone: 'TBD',
    cba: 'Rates effective 3/30/2025',
    jurisdiction: 'Oregon and SW Washington',
  },
}

const ZONES_82 = [
  { zone: 'Zone 1-2', miles: '0–30', rate: '$0', notes: 'Free' },
  { zone: 'Zone 3', miles: '30–40', rate: '$30', notes: '' },
  { zone: 'Zone 4', miles: '40–50', rate: '$40', notes: '' },
  { zone: 'Zone 5', miles: '50–60', rate: '$55', notes: '' },
  { zone: 'Zone 6', miles: '60–70', rate: '$65', notes: '' },
  { zone: 'Zone 6+', miles: '70+', rate: '$140', notes: 'Subsistence (incl. $35 meals)' },
]

const ZONES_7 = [
  { zone: 'Free Zone', miles: '0–20', rate: '$0', notes: 'No travel pay' },
  { zone: 'Mileage Zone', miles: '21–70', rate: 'IRS mileage', notes: 'Round-trip from free zone edge' },
  { zone: 'Per Diem', miles: '71+', rate: '$150/day', notes: 'All workers regardless of transport' },
]

const ZONES_7A = [
  { zone: 'Zone 1', miles: '0–20', rate: '$0', notes: 'Free' },
  { zone: 'Zone 2', miles: '21–30', rate: '$20', notes: '' },
  { zone: 'Zone 3', miles: '31–40', rate: '$30', notes: '' },
  { zone: 'Zone 4', miles: '41–50', rate: '$40', notes: '' },
  { zone: 'Zone 5', miles: '51–60', rate: '$50', notes: '' },
  { zone: 'Zone 6', miles: '61–70', rate: '$60', notes: '' },
  { zone: 'Zone 7', miles: '71+', rate: '$150', notes: 'Per diem' },
]

const ZONES_36 = [
  { zone: 'Zone 1', miles: '0–30', rate: '$0', cv: '$0', notes: 'Free' },
  { zone: 'Zone 2', miles: '31–50', rate: '$30', cv: '$19', notes: '' },
  { zone: 'Zone 3', miles: '51–70', rate: '$65', cv: '$29', notes: '' },
  { zone: 'Zone 4', miles: '71–100', rate: '$85', cv: '$43', notes: '' },
  { zone: 'Zone 5', miles: '100+', rate: '$160', cv: '$135', notes: 'Subsistence' },
]

function ZoneTable({ localId, isAppendixA }: { localId: number; isAppendixA: boolean }) {
  if (localId === 82) {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-1 pr-2">Zone</th><th className="py-1 pr-2">Miles</th><th className="py-1 pr-2">Rate</th><th className="py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {ZONES_82.map((z) => (
            <tr key={z.zone} className="border-b border-gray-100">
              <td className="py-1 pr-2 font-medium">{z.zone}</td><td className="py-1 pr-2">{z.miles}</td><td className="py-1 pr-2">{z.rate}</td><td className="py-1 text-gray-400">{z.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (localId === 7) {
    return (
      <div className="space-y-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 pr-2">Zone</th><th className="py-1 pr-2">Miles</th><th className="py-1 pr-2">Rate</th><th className="py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ZONES_7.map((z) => (
              <tr key={z.zone} className="border-b border-gray-100">
                <td className="py-1 pr-2 font-medium">{z.zone}</td><td className="py-1 pr-2">{z.miles}</td><td className="py-1 pr-2">{z.rate}</td><td className="py-1 text-gray-400">{z.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAppendixA && (
          <>
            <p className="text-xs font-semibold text-emerald-700">Appendix A Zones</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1 pr-2">Zone</th><th className="py-1 pr-2">Miles</th><th className="py-1 pr-2">Rate</th><th className="py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ZONES_7A.map((z) => (
                  <tr key={z.zone} className="border-b border-gray-100">
                    <td className="py-1 pr-2 font-medium">{z.zone}</td><td className="py-1 pr-2">{z.miles}</td><td className="py-1 pr-2">{z.rate}</td><td className="py-1 text-gray-400">{z.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }

  // Local 36
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-1 pr-2">Zone</th><th className="py-1 pr-2">Miles</th><th className="py-1 pr-2">Rate</th><th className="py-1 pr-2">Co. Vehicle</th><th className="py-1">Notes</th>
        </tr>
      </thead>
      <tbody>
        {ZONES_36.map((z) => (
          <tr key={z.zone} className="border-b border-gray-100">
            <td className="py-1 pr-2 font-medium">{z.zone}</td><td className="py-1 pr-2">{z.miles}</td><td className="py-1 pr-2">{z.rate}</td><td className="py-1 pr-2">{z.cv}</td><td className="py-1 text-gray-400">{z.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Sidebar({ selectedCounty, dispatchPoints, appendixACounties, onClose }: SidebarProps) {
  const localId = selectedCounty.localId ?? 82
  const local = LOCAL_DATA[localId] ?? LOCAL_DATA[82]
  const isAppendixA = localId === 7 && appendixACounties.has(selectedCounty.fips)

  return (
    <div className="absolute left-0 top-0 w-96 h-full overflow-y-auto bg-white shadow-xl z-20 p-5 border-r border-gray-200">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100 transition-colors"
      >
        <X className="h-4 w-4 text-gray-400" />
      </button>

      <div className="space-y-5">
        {/* County header */}
        <div>
          <span
            className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full text-white mb-1"
            style={{ backgroundColor: local.color }}
          >
            {local.name}
          </span>
          <h3 className="text-base font-semibold text-gray-900">
            {selectedCounty.name} County, {selectedCounty.state}
          </h3>
        </div>

        {/* Calculator */}
        <Calculator
          selectedCounty={selectedCounty}
          dispatchPoints={dispatchPoints}
          appendixACounties={appendixACounties}
        />

        {/* Travel & Subsistence */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Travel & Subsistence</h4>
          <ZoneTable localId={localId} isAppendixA={isAppendixA} />
          <p className="text-[10px] text-gray-400">Rates per CBA — verify with local hall before bidding.</p>
        </div>

        {/* Jurisdiction */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jurisdiction</h4>
          <p className="text-xs text-gray-600 mt-1">{local.jurisdiction}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">CBA: {local.cba}</p>
        </div>

        {/* Hall Contact */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hall Contact</h4>
          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
            <p className="font-medium">BM: {local.bm}</p>
            <p>{local.address}</p>
            <p>{local.phone}</p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-3">
          Reference only — verify rates with the local hall before bidding.
        </p>
      </div>
    </div>
  )
}
