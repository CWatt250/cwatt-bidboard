'use client'

import { X, MapPin, Phone, Building2 } from 'lucide-react'
import Calculator from './Calculator'
import type { DispatchPoint } from '@/lib/data/jurisdiction-calc'

interface LocalData {
  name: string
  color: string
  hallCity: string
  address: string
  phone: string
  bm: string
  cba: string
  jurisdiction: string
  subsNote: string
  travelZones: {
    label: string
    miles: string
    rate: string
    note: string
    cvRate?: string
  }[]
  appendixA?: {
    label: string
    zones: { label: string; miles: string; rate: string }[]
  }
}

interface SidebarProps {
  selectedCounty: {
    fips: string
    name: string
    state: string
    lat: number
    lng: number
    localId: number | null
  } | null
  locals: Record<number, LocalData>
  dispatchPoints: Record<number, DispatchPoint[]>
  zoneRates: unknown[]
  appendixACounties: Set<string>
  onClose: () => void
}

export default function Sidebar({
  selectedCounty,
  locals,
  dispatchPoints,
  zoneRates: _zoneRates,
  appendixACounties,
  onClose,
}: SidebarProps) {
  if (!selectedCounty) return null

  const local =
    selectedCounty.localId !== null ? locals[selectedCounty.localId] : null

  const isLocal36 = selectedCounty.localId === 36
  const isLocal7 = selectedCounty.localId === 7
  const showAppendixA =
    isLocal7 && local?.appendixA && appendixACounties.has(selectedCounty.fips)

  return (
    <aside className="absolute left-0 top-0 z-30 h-full w-[380px] overflow-y-auto rounded-r-xl bg-white shadow-lg border-r border-border/50">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Close sidebar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-5 p-4 pt-5">
        {/* County header */}
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <h2 className="text-sm font-medium leading-tight">
              {selectedCounty.name}, {selectedCounty.state}
            </h2>
          </div>
          {local && (
            <span
              className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: local.color }}
            >
              {local.name}
            </span>
          )}
          {!local && (
            <span className="mt-1.5 inline-block rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              No local assigned
            </span>
          )}
        </div>

        {/* Daily cost calculator */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Daily Cost Calculator
          </h3>
          <Calculator
            selectedCounty={selectedCounty}
            dispatchPoints={dispatchPoints}
            appendixACounties={appendixACounties}
          />
        </section>

        {/* Travel & subsistence table */}
        {local && local.travelZones.length > 0 && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Travel &amp; Subsistence
            </h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Zone
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Miles
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Rate
                    </th>
                    {isLocal36 && (
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                        Co. Vehicle
                      </th>
                    )}
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {local.travelZones.map((tz, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-2 py-1.5 font-medium">{tz.label}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {tz.miles}
                      </td>
                      <td className="px-2 py-1.5">{tz.rate}</td>
                      {isLocal36 && (
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {tz.cvRate ?? '—'}
                        </td>
                      )}
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {tz.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {local.subsNote && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {local.subsNote}
              </p>
            )}
          </section>
        )}

        {/* Appendix A table (Local 7 only) */}
        {showAppendixA && local?.appendixA && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {local.appendixA.label}
            </h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Zone
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Miles
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {local.appendixA.zones.map((az, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-2 py-1.5 font-medium">{az.label}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {az.miles}
                      </td>
                      <td className="px-2 py-1.5">{az.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Jurisdiction */}
        {local && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Jurisdiction
            </h3>
            <p className="text-sm text-foreground">{local.jurisdiction}</p>
          </section>
        )}

        {/* Hall contact */}
        {local && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Hall Contact
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium">{local.bm}</p>
                  <p className="text-xs text-muted-foreground">
                    Business Manager
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground text-xs">
                  {local.address}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <a
                  href={`tel:${local.phone}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {local.phone}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-3">
          Reference only — verify rates with the local hall before bidding.
        </p>
      </div>
    </aside>
  )
}
