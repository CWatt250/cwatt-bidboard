'use client'

import type { BranchMonthlyStats, BundledStats } from '@/lib/recap-aggregations'
import { BRANCH_LABELS } from '@/lib/supabase/types'

interface ExportButtonsProps {
  stats: BranchMonthlyStats[]
  month: number
  year: number
  bundleMode: boolean
  bundled: BundledStats | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const BRANCH_NUMBERS: Record<string, number> = {
  PSC: 467,
  SEA: 466,
  POR: 465,
  PHX: 462,
  SLC: 468,
}

function fmt(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    const formatted = Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(value / 1_000)
    return `$${formatted}K`
  }
  return `$${value.toLocaleString()}`
}

function buildEmailText(
  stats: BranchMonthlyStats[],
  month: number,
  year: number,
  bundleMode: boolean,
  bundled: BundledStats | null,
): string {
  const label = `${MONTH_NAMES[month - 1]} ${year} Recap`
  const lines: string[] = [label, '='.repeat(label.length), '']

  if (bundleMode && bundled) {
    lines.push(`Bids Submitted: ${bundled.submitted}`)
    lines.push(`Total Bid Value: ${fmt(bundled.totalValue)}`)
    lines.push(`Total Secured: ${fmt(bundled.secured)}`)
  } else {
    for (const s of stats) {
      lines.push(`${BRANCH_LABELS[s.branch]} (#${BRANCH_NUMBERS[s.branch]})`)
      lines.push(`  • Bids Submitted: ${s.submitted}`)
      lines.push(`  • Total Bid Value: ${fmt(s.totalValue)}`)
      lines.push(`  • Total Secured: ${fmt(s.secured)}`)
      lines.push('')
    }
    if (stats.length >= 2) {
      lines.push('Combined')
      lines.push(
        `  • Bids Submitted: ${stats.reduce((sum, s) => sum + s.submitted, 0)}`,
      )
      lines.push(
        `  • Total Bid Value: ${fmt(stats.reduce((sum, s) => sum + s.totalValue, 0))}`,
      )
      lines.push(
        `  • Total Secured: ${fmt(stats.reduce((sum, s) => sum + s.secured, 0))}`,
      )
      lines.push('')
    }
  }

  lines.push('')
  return lines.join('\n')
}

function buildCSV(
  stats: BranchMonthlyStats[],
  month: number,
  year: number,
  bundleMode: boolean,
  bundled: BundledStats | null,
): string {
  const rows: string[] = ['Branch,Submitted,Total Value,Secured']
  if (bundleMode && bundled) {
    rows.push(`All Branches,${bundled.submitted},${bundled.totalValue},${bundled.secured}`)
  } else {
    for (const s of stats) {
      rows.push(`${BRANCH_LABELS[s.branch]},${s.submitted},${s.totalValue},${s.secured}`)
    }
    if (stats.length >= 2) {
      rows.push(
        `Combined,${stats.reduce((sum, s) => sum + s.submitted, 0)},${stats.reduce((sum, s) => sum + s.totalValue, 0)},${stats.reduce((sum, s) => sum + s.secured, 0)}`,
      )
    }
  }
  return rows.join('\n')
}

export function ExportButtons({
  stats,
  month,
  year,
  bundleMode,
  bundled,
}: ExportButtonsProps) {
  function handleCopyEmail() {
    const text = buildEmailText(stats, month, year, bundleMode, bundled)
    navigator.clipboard.writeText(text).catch(() => {
      // fallback — silent
    })
  }

  function handleDownloadCSV() {
    const csv = buildCSV(stats, month, year, bundleMode, bundled)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monthly-recap-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportPDF() {
    window.print()
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleCopyEmail}
        style={{
          fontSize: 13,
          fontWeight: 500,
          padding: '6px 14px',
          borderRadius: 8,
          border: '0.5px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
        }}
      >
        Copy as email
      </button>
      <button
        type="button"
        onClick={handleDownloadCSV}
        style={{
          fontSize: 13,
          fontWeight: 500,
          padding: '6px 14px',
          borderRadius: 8,
          border: '0.5px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
        }}
      >
        Download CSV
      </button>
      <button
        type="button"
        onClick={handleExportPDF}
        style={{
          fontSize: 13,
          fontWeight: 500,
          padding: '6px 14px',
          borderRadius: 8,
          border: '0.5px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
        }}
      >
        Export PDF
      </button>
    </div>
  )
}
