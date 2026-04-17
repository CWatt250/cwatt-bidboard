'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

interface HallInfo {
  id: number
  hall_city: string | null
  address: string | null
  phone: string | null
  business_manager: string | null
  cba_label: string | null
  jurisdiction: string | null
  sub_note: string | null
}

interface DispatchPoint {
  id: number
  local_id: number
  name: string
  lat: number
  lng: number
  sort_order: number
}

interface ZoneRate {
  id: number
  local_id: number
  zone_label: string
  min_miles: number
  max_miles: number
  personal_vehicle_rate: number
  company_vehicle_rate: number
  notes: string | null
  sort_order: number
  is_appendix_a: boolean
}

const LOCALS: { id: number; label: string; color: string }[] = [
  { id: 82, label: 'Local 82', color: '#4a9eff' },
  { id: 7, label: 'Local 7', color: '#3dd68c' },
  { id: 36, label: 'Local 36', color: '#f5a623' },
]

export default function CbaDataPage() {
  const { isAdmin } = useUserRole()
  const [selectedLocal, setSelectedLocal] = useState(LOCALS[0])
  const [loading, setLoading] = useState(true)

  const [hallInfo, setHallInfo] = useState<HallInfo | null>(null)
  const [dispatchPoints, setDispatchPoints] = useState<DispatchPoint[]>([])
  const [zoneRates, setZoneRates] = useState<ZoneRate[]>([])

  /* ---- Fetch all data for the selected local ---- */
  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const localId = selectedLocal.id

    const [hallRes, dpRes, zrRes] = await Promise.all([
      supabase.from('locals').select('*').eq('id', localId).single(),
      supabase.from('dispatch_points').select('*').eq('local_id', localId).order('sort_order'),
      supabase.from('zone_rates').select('*').eq('local_id', localId).order('sort_order'),
    ])

    if (hallRes.error) toast.error('Failed to load hall info')
    if (dpRes.error) toast.error('Failed to load dispatch points')
    if (zrRes.error) toast.error('Failed to load zone rates')

    setHallInfo((hallRes.data as HallInfo) ?? null)
    setDispatchPoints((dpRes.data as DispatchPoint[]) ?? [])
    setZoneRates((zrRes.data as ZoneRate[]) ?? [])
    setLoading(false)
  }, [selectedLocal.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ---- Dispatch point handlers ---- */
  const saveDispatchField = async (id: number, field: string, value: string) => {
    const supabase = createClient()
    const numericFields = ['lat', 'lng', 'sort_order']
    const parsed = numericFields.includes(field) ? parseFloat(value) || 0 : value
    const { error } = await supabase
      .from('dispatch_points')
      .update({ [field]: parsed })
      .eq('id', id)
    if (error) toast.error('Failed to save dispatch point')
  }

  const addDispatchPoint = async () => {
    const supabase = createClient()
    const nextSort = dispatchPoints.length > 0
      ? Math.max(...dispatchPoints.map((d) => d.sort_order)) + 1
      : 1
    const { error } = await supabase.from('dispatch_points').insert({
      local_id: selectedLocal.id,
      name: '',
      lat: 0,
      lng: 0,
      sort_order: nextSort,
    })
    if (error) toast.error('Failed to add dispatch point')
    else fetchData()
  }

  const deleteDispatchPoint = async (id: number) => {
    const supabase = createClient()
    const { error } = await supabase.from('dispatch_points').delete().eq('id', id)
    if (error) toast.error('Failed to delete dispatch point')
    else setDispatchPoints((prev) => prev.filter((d) => d.id !== id))
  }

  /* ---- Zone rate handlers ---- */
  const saveZoneField = async (id: number, field: string, value: string) => {
    const supabase = createClient()
    const numericFields = ['min_miles', 'max_miles', 'personal_vehicle_rate', 'company_vehicle_rate', 'sort_order']
    const parsed = numericFields.includes(field) ? parseFloat(value) || 0 : value
    const { error } = await supabase
      .from('zone_rates')
      .update({ [field]: parsed })
      .eq('id', id)
    if (error) toast.error('Failed to save zone rate')
  }

  const addZoneRate = async (isAppendixA = false) => {
    const supabase = createClient()
    const relevantRates = zoneRates.filter((z) => z.is_appendix_a === isAppendixA)
    const nextSort = relevantRates.length > 0
      ? Math.max(...relevantRates.map((z) => z.sort_order)) + 1
      : 1
    const { error } = await supabase.from('zone_rates').insert({
      local_id: selectedLocal.id,
      zone_label: '',
      min_miles: 0,
      max_miles: 0,
      personal_vehicle_rate: 0,
      company_vehicle_rate: 0,
      notes: '',
      sort_order: nextSort,
      is_appendix_a: isAppendixA,
    })
    if (error) toast.error('Failed to add zone rate')
    else fetchData()
  }

  const deleteZoneRate = async (id: number) => {
    const supabase = createClient()
    const { error } = await supabase.from('zone_rates').delete().eq('id', id)
    if (error) toast.error('Failed to delete zone rate')
    else setZoneRates((prev) => prev.filter((z) => z.id !== id))
  }

  /* ---- Hall info handler ---- */
  const saveHallInfo = async () => {
    if (!hallInfo) return
    const supabase = createClient()
    const { error } = await supabase
      .from('locals')
      .update({
        hall_city: hallInfo.hall_city,
        address: hallInfo.address,
        phone: hallInfo.phone,
        business_manager: hallInfo.business_manager,
        cba_label: hallInfo.cba_label,
        jurisdiction: hallInfo.jurisdiction,
        sub_note: hallInfo.sub_note,
      })
      .eq('id', selectedLocal.id)
    if (error) toast.error('Failed to save hall information')
    else toast.success('Hall information saved')
  }

  /* ---- Zone rate table renderer ---- */
  const renderZoneTable = (rates: ZoneRate[], isAppendixA: boolean, title: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addZoneRate(isAppendixA)}>
          <Plus className="mr-1 size-3" /> Add Zone
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1.5 text-left font-medium">Zone Label</th>
              <th className="px-2 py-1.5 text-left font-medium">Min Miles</th>
              <th className="px-2 py-1.5 text-left font-medium">Max Miles</th>
              <th className="px-2 py-1.5 text-left font-medium">Personal Rate</th>
              <th className="px-2 py-1.5 text-left font-medium">Co. Vehicle Rate</th>
              <th className="px-2 py-1.5 text-left font-medium">Notes</th>
              <th className="w-10 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rates.map((z) => (
              <tr key={z.id} className="border-b last:border-0">
                <td className="px-1 py-0.5">
                  <Input defaultValue={z.zone_label} onBlur={(e) => saveZoneField(z.id, 'zone_label', e.target.value)} className="h-8 text-sm" />
                </td>
                <td className="px-1 py-0.5">
                  <Input defaultValue={String(z.min_miles)} onBlur={(e) => saveZoneField(z.id, 'min_miles', e.target.value)} className="h-8 w-20 text-sm" />
                </td>
                <td className="px-1 py-0.5">
                  <Input defaultValue={String(z.max_miles)} onBlur={(e) => saveZoneField(z.id, 'max_miles', e.target.value)} className="h-8 w-20 text-sm" />
                </td>
                <td className="px-1 py-0.5">
                  <Input defaultValue={String(z.personal_vehicle_rate)} onBlur={(e) => saveZoneField(z.id, 'personal_vehicle_rate', e.target.value)} className="h-8 w-24 text-sm" />
                </td>
                <td className="px-1 py-0.5">
                  <Input defaultValue={String(z.company_vehicle_rate)} onBlur={(e) => saveZoneField(z.id, 'company_vehicle_rate', e.target.value)} className="h-8 w-24 text-sm" />
                </td>
                <td className="px-1 py-0.5">
                  <Input defaultValue={z.notes ?? ''} onBlur={(e) => saveZoneField(z.id, 'notes', e.target.value)} className="h-8 text-sm" />
                </td>
                <td className="px-1 py-0.5 text-center">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => deleteZoneRate(z.id)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {rates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-muted-foreground">No zone rates yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  /* ---- Access check ---- */
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Access denied. Admin only.</p>
      </div>
    )
  }

  /* ---- Render ---- */
  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading CBA data...</p>
  }

  const standardZones = zoneRates.filter((z) => !z.is_appendix_a)
  const appendixAZones = zoneRates.filter((z) => z.is_appendix_a)

  return (
    <div className="space-y-6">
      {/* Local selector pills */}
      <div className="flex gap-2">
        {LOCALS.map((local) => {
          const isActive = selectedLocal.id === local.id
          return (
            <button
              key={local.id}
              onClick={() => setSelectedLocal(local)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: isActive ? local.color : 'transparent',
                color: isActive ? '#fff' : 'var(--text3)',
                border: isActive ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {local.label}
            </button>
          )
        })}
      </div>

      {/* Section 1: Dispatch Points */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Dispatch Points</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addDispatchPoint}>
              <Plus className="mr-1 size-3" /> Add Dispatch Point
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium">City Name</th>
                  <th className="px-2 py-1.5 text-left font-medium">Lat</th>
                  <th className="px-2 py-1.5 text-left font-medium">Lng</th>
                  <th className="w-10 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {dispatchPoints.map((dp) => (
                  <tr key={dp.id} className="border-b last:border-0">
                    <td className="px-1 py-0.5">
                      <Input defaultValue={dp.name} onBlur={(e) => saveDispatchField(dp.id, 'name', e.target.value)} className="h-8 text-sm" />
                    </td>
                    <td className="px-1 py-0.5">
                      <Input defaultValue={String(dp.lat)} onBlur={(e) => saveDispatchField(dp.id, 'lat', e.target.value)} className="h-8 w-28 text-sm" />
                    </td>
                    <td className="px-1 py-0.5">
                      <Input defaultValue={String(dp.lng)} onBlur={(e) => saveDispatchField(dp.id, 'lng', e.target.value)} className="h-8 w-28 text-sm" />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => deleteDispatchPoint(dp.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {dispatchPoints.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">No dispatch points yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Zone Rates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Zone Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedLocal.id === 7 ? (
            <>
              {renderZoneTable(standardZones, false, 'Standard Zones')}
              {renderZoneTable(appendixAZones, true, 'Appendix A Zones')}
            </>
          ) : (
            renderZoneTable(standardZones, false, 'Zones')
          )}
        </CardContent>
      </Card>

      {/* Section 3: Hall Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Hall Information</CardTitle>
        </CardHeader>
        <CardContent>
          {hallInfo ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Hall City</Label>
                <Input value={hallInfo.hall_city ?? ''} onChange={(e) => setHallInfo({ ...hallInfo, hall_city: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input value={hallInfo.address ?? ''} onChange={(e) => setHallInfo({ ...hallInfo, address: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={hallInfo.phone ?? ''} onChange={(e) => setHallInfo({ ...hallInfo, phone: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Business Manager</Label>
                <Input value={hallInfo.business_manager ?? ''} onChange={(e) => setHallInfo({ ...hallInfo, business_manager: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CBA Label</Label>
                <Input value={hallInfo.cba_label ?? ''} onChange={(e) => setHallInfo({ ...hallInfo, cba_label: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Jurisdiction</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={hallInfo.jurisdiction ?? ''}
                  onChange={(e) => setHallInfo({ ...hallInfo, jurisdiction: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Sub Note</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={hallInfo.sub_note ?? ''}
                  onChange={(e) => setHallInfo({ ...hallInfo, sub_note: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button size="sm" onClick={saveHallInfo}>Save Hall Information</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hall information found for this local.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
