'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const DEFAULTS = {
  totalHours: '2500',
  hoursPerDay: '8',
  daysPerWeek: '5',
  durationMonths: '3',
}

function parsePositive(val: string): number | null {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) return null
  return n
}

export default function CrewSizePage() {
  const [totalHours, setTotalHours] = useState(DEFAULTS.totalHours)
  const [hoursPerDay, setHoursPerDay] = useState(DEFAULTS.hoursPerDay)
  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULTS.daysPerWeek)
  const [durationMonths, setDurationMonths] = useState(DEFAULTS.durationMonths)

  const h = parsePositive(totalHours)
  const hpd = parsePositive(hoursPerDay)
  const dpw = parsePositive(daysPerWeek)
  const dm = parsePositive(durationMonths)

  const allValid = h !== null && hpd !== null && dpw !== null && dm !== null

  let workingDaysPerMonth: number | null = null
  let workingHoursPerMonth: number | null = null
  let totalAvailable: number | null = null
  let crewSize: number | null = null
  let recommended: number | null = null

  if (allValid) {
    workingDaysPerMonth = (dpw! * 52) / 12
    workingHoursPerMonth = workingDaysPerMonth * hpd!
    totalAvailable = workingHoursPerMonth * dm!
    crewSize = h! / totalAvailable
    recommended = Math.ceil(crewSize)
  }

  function handleReset() {
    setTotalHours(DEFAULTS.totalHours)
    setHoursPerDay(DEFAULTS.hoursPerDay)
    setDaysPerWeek(DEFAULTS.daysPerWeek)
    setDurationMonths(DEFAULTS.durationMonths)
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crew Size Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="total-hours">Total Labor Hours</Label>
              <Input
                id="total-hours"
                type="number"
                min="0"
                step="any"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours-per-day">Hours Per Day</Label>
              <Input
                id="hours-per-day"
                type="number"
                min="0"
                step="any"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days-per-week">Days Per Week</Label>
              <Input
                id="days-per-week"
                type="number"
                min="0"
                step="any"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duration-months">Duration (Months)</Label>
              <Input
                id="duration-months"
                type="number"
                min="0"
                step="any"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-1 text-center">
            <div className="text-5xl font-bold tabular-nums">
              {crewSize !== null ? crewSize.toFixed(2) : '—'}
            </div>
            <div className="text-sm text-muted-foreground">
              {recommended !== null && dm !== null
                ? `${recommended} worker${recommended !== 1 ? 's' : ''} recommended · ${dm} month duration`
                : 'Enter valid inputs above'}
            </div>
          </div>

          {allValid && (
            <div className="rounded-lg border overflow-hidden text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Step</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Working Days / Month</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {workingDaysPerMonth!.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Working Hours / Month</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {workingHoursPerMonth!.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Total Hours Available</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {totalAvailable!.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Crew Size (exact)</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {crewSize!.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-muted/30">
                    <td className="px-3 py-2 font-medium">Recommended (rounded up)</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {recommended}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <Button variant="outline" onClick={handleReset} className="w-full">
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
