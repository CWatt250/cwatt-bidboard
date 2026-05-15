'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Branch, Bid, BidLineItem } from '@/lib/supabase/types'
import {
  bundledStats,
  monthlyBranchStats,
  monthRange,
  type BranchMonthlyStats,
  type BundledStats,
} from '@/lib/recap-aggregations'
import { BranchSelector } from './BranchSelector'
import { MonthlyReport } from './MonthlyReport'
import { ExportButtons } from './ExportButtons'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function mapBidRow(row: any): Bid {
  const line_items: BidLineItem[] = (row.bid_line_items ?? []).map((li: any) => ({
    ...li,
    estimator_name: li.estimator?.name ?? null,
  }))
  const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
  return {
    ...row,
    line_items,
    total_price,
  }
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MonthlyTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [branches, setBranches] = useState<Branch[]>(['PSC', 'SEA', 'POR', 'PHX', 'SLC'])
  const [bundleMode, setBundleMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<BranchMonthlyStats[]>([])
  const [bundled, setBundled] = useState<BundledStats | null>(null)
  const [generated, setGenerated] = useState(false)

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years: number[] = []
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
      years.push(y)
    }
    return years
  }, [])

  const handleGenerate = useCallback(async () => {
    if (branches.length === 0) return
    setLoading(true)
    setError(null)

    const { start, end } = monthRange(year, month)
    const supabase = createClient()

    let query = supabase
      .from('bids')
      .select(`
        id,
        project_name,
        branch,
        status,
        bid_due_date,
        bid_line_items(*)
      `)
      .gte('bid_due_date', toYmd(start))
      .lte('bid_due_date', toYmd(end))
      .in('branch', branches)
      .order('bid_due_date', { ascending: false })

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const bids: Bid[] = (data ?? []).map(mapBidRow)

    const s = monthlyBranchStats(bids, branches, year, month)
    setStats(s)
    setBundled(bundledStats(bids, year, month))
    setGenerated(true)
    setLoading(false)
  }, [month, year, branches])

  const selectStyle: React.CSSProperties = {
    height: 34,
    padding: '0 8px',
    borderRadius: 6,
    border: '0.5px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg, var(--radius))',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Month / Year pickers */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={selectStyle}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={selectStyle}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Branch selector */}
        <BranchSelector selected={branches} onChange={setBranches} />

        {/* Bundle toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            Bundle all branches
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={bundleMode}
            onClick={() => setBundleMode(!bundleMode)}
            style={{
              width: 38,
              height: 22,
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              background: bundleMode ? 'var(--accent)' : 'var(--border)',
              position: 'relative',
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: bundleMode ? 18 : 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
          </button>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || branches.length === 0}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: loading || branches.length === 0 ? 'var(--border)' : 'var(--accent)',
            color: loading || branches.length === 0 ? 'var(--text3)' : 'white',
            cursor: loading || branches.length === 0 ? 'default' : 'pointer',
            alignSelf: 'flex-start',
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {loading ? 'Generating...' : 'Generate Recap'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {generated && !loading && (
        <>
          <MonthlyReport
            stats={stats}
            month={month}
            year={year}
            bundleMode={bundleMode}
            bundled={bundled}
          />
          <ExportButtons
            stats={stats}
            month={month}
            year={year}
            bundleMode={bundleMode}
            bundled={bundled}
          />
        </>
      )}
    </div>
  )
}
