'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function parsePositiveFloat(val: string): number | null {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) return null
  return n
}

export default function MikeDiscountPage() {
  const [listed, setListed] = useState('')
  const [actual, setActual] = useState('')

  const listedVal = parsePositiveFloat(listed)
  const actualVal = parsePositiveFloat(actual)

  const bothValid = listedVal !== null && actualVal !== null
  const isError = bothValid && actualVal > listedVal

  let discountPct: number | null = null
  let savingsPerUnit: number | null = null

  if (bothValid && !isError) {
    discountPct = ((listedVal - actualVal) / listedVal) * 100
    savingsPerUnit = listedVal - actualVal
  }

  function handleClear() {
    setListed('')
    setActual('')
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>MIKE Discount Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="listed-price">MIKE Listed Price</Label>
              <Input
                id="listed-price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={listed}
                onChange={(e) => setListed(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actual-price">Actual Price</Label>
              <Input
                id="actual-price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                aria-invalid={isError || undefined}
              />
            </div>
          </div>

          {isError && (
            <p className="text-sm text-destructive">Actual price cannot exceed listed price.</p>
          )}

          <div className="border rounded-lg p-4 space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold tabular-nums">
                {discountPct !== null ? `${discountPct.toFixed(1)}%` : '—'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Discount</div>
            </div>

            {savingsPerUnit !== null && (
              <p className="text-center text-sm font-medium">
                You save ${savingsPerUnit.toFixed(2)} per unit
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1">MIKE Price</div>
                <div className="text-lg font-bold tabular-nums">
                  {listedVal !== null ? `$${listedVal.toFixed(2)}` : '—'}
                </div>
              </div>
              <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-2 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1">You Pay</div>
                <div className="text-lg font-bold tabular-nums">
                  {actualVal !== null ? `$${actualVal.toFixed(2)}` : '—'}
                </div>
              </div>
            </div>
          </div>

          <Button variant="outline" onClick={handleClear} className="w-full">
            Clear
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
