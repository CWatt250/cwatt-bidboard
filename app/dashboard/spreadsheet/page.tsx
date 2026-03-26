'use client'

import { DownloadIcon } from 'lucide-react'
import { useBids } from '@/hooks/useBids'
import { DataTable } from '@/components/spreadsheet/DataTable'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { Button } from '@/components/ui/button'
import type { Bid } from '@/hooks/useBids'

function formatCurrencyRaw(value: number | null): string {
  if (value === null) return 'TBD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateRaw(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportToCsv(bids: Bid[]) {
  const headers = [
    'Project Name',
    'Client',
    'Scope',
    'Branch',
    'Estimator',
    'Bid Price',
    'Status',
    'Bid Due Date',
    'Project Start Date',
    'Notes',
  ]

  const rows = bids.map((bid) => [
    bid.project_name,
    bid.client,
    bid.scope,
    bid.branch,
    bid.estimator_name ?? 'Unassigned',
    formatCurrencyRaw(bid.bid_price),
    bid.status,
    formatDateRaw(bid.bid_due_date),
    formatDateRaw(bid.project_start_date),
    bid.notes ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const dateStr = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cwatt-bids-${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SpreadsheetPage() {
  const { bids, loading, error } = useBids()

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Spreadsheet</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportToCsv(bids)}
            disabled={loading || bids.length === 0}
          >
            <DownloadIcon />
            Export CSV
          </Button>
          <NewBidDialog />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error loading bids: {error}
        </div>
      )}

      <DataTable bids={bids} loading={loading} />
    </div>
  )
}
