'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DUCTWRAP_THICKNESSES = [
  { label: '1.5"', sqft: 400 },
  { label: '2"', sqft: 300 },
  { label: '3"', sqft: 200 },
  { label: '4"', sqft: 180 },
  { label: '7"', sqft: 120 },
]

const DUCTBOARD_SIZES = [
  { label: "8'x4' (32 sqft)", sqft: 32 },
  { label: "4'x2' (8 sqft)", sqft: 8 },
]

const ACOUSTIC_PRODUCTS = [
  { label: 'B-10LAG 1" (135 sqft/roll)', sqft: 135 },
  { label: 'B-20LAG 2" (135 sqft/roll)', sqft: 135 },
]

function parsePositiveFloat(val: string): number | null {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) return null
  return n
}

function CostResult({ costPerSqft }: { costPerSqft: number | null }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <div className="text-3xl font-bold tabular-nums">
        {costPerSqft !== null ? `$${costPerSqft.toFixed(2)}` : '—'}
      </div>
      <div className="text-sm text-muted-foreground mt-1">per square foot</div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: '0 28px 0 8px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '0.875rem',
  cursor: 'pointer',
  appearance: 'none',
  width: '100%',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238892b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
}

function DuctwrapCalc() {
  const [price, setPrice] = useState('')
  const [thicknessIdx, setThicknessIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = DUCTWRAP_THICKNESSES[thicknessIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ductwrap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Price per Roll</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Thickness</Label>
            <select
              style={selectStyle}
              value={thicknessIdx}
              onChange={(e) => setThicknessIdx(Number(e.target.value))}
            >
              {DUCTWRAP_THICKNESSES.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label} — {t.sqft} sqft/roll
                </option>
              ))}
            </select>
          </div>
        </div>
        <CostResult costPerSqft={costPerSqft} />
      </CardContent>
    </Card>
  )
}

function DuctboardCalc() {
  const [price, setPrice] = useState('')
  const [sizeIdx, setSizeIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = DUCTBOARD_SIZES[sizeIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duct Board</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Price per Board</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Board Size</Label>
            <select
              style={selectStyle}
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
            >
              {DUCTBOARD_SIZES.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CostResult costPerSqft={costPerSqft} />
      </CardContent>
    </Card>
  )
}

function AcousticCalc() {
  const [price, setPrice] = useState('')
  const [productIdx, setProductIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = ACOUSTIC_PRODUCTS[productIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acoustic Wrap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Price per Roll</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Product</Label>
            <select
              style={selectStyle}
              value={productIdx}
              onChange={(e) => setProductIdx(Number(e.target.value))}
            >
              {ACOUSTIC_PRODUCTS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CostResult costPerSqft={costPerSqft} />
      </CardContent>
    </Card>
  )
}

export default function MaterialPricePage() {
  return (
    <div className="space-y-6">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
        Material Price Calculator
      </h1>
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <DuctwrapCalc />
        <DuctboardCalc />
        <AcousticCalc />
      </div>
    </div>
  )
}
