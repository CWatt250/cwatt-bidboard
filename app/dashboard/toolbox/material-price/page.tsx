'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MaterialTab = 'ductwrap' | 'ductboard' | 'acoustic'

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

function DuctwrapCalc() {
  const [price, setPrice] = useState('')
  const [thicknessIdx, setThicknessIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = DUCTWRAP_THICKNESSES[thicknessIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <div className="space-y-4">
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
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </div>
  )
}

function DuctboardCalc() {
  const [price, setPrice] = useState('')
  const [sizeIdx, setSizeIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = DUCTBOARD_SIZES[sizeIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <div className="space-y-4">
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
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </div>
  )
}

function AcousticCalc() {
  const [price, setPrice] = useState('')
  const [productIdx, setProductIdx] = useState(0)

  const priceVal = parsePositiveFloat(price)
  const sqft = ACOUSTIC_PRODUCTS[productIdx].sqft
  const costPerSqft = priceVal !== null ? priceVal / sqft : null

  return (
    <div className="space-y-4">
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
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </div>
  )
}

const TABS: { key: MaterialTab; label: string }[] = [
  { key: 'ductwrap', label: 'Ductwrap' },
  { key: 'ductboard', label: 'Duct Board' },
  { key: 'acoustic', label: 'Acoustic Wrap' },
]

export default function MaterialPricePage() {
  const [activeTab, setActiveTab] = useState<MaterialTab>('ductwrap')

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Material Price Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex border-b">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'ductwrap' && <DuctwrapCalc />}
          {activeTab === 'ductboard' && <DuctboardCalc />}
          {activeTab === 'acoustic' && <AcousticCalc />}
        </CardContent>
      </Card>
    </div>
  )
}
