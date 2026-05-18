'use client'

import { useEffect, useMemo, useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useBids } from '@/hooks/useBids'
import { useUserRole } from '@/contexts/userRole'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/spreadsheet/DataTable'
import type { EstimatorFilter } from '@/components/spreadsheet/FilterBar'
import { NewBidDialog } from '@/components/shared/NewBidDialog'
import { Button } from '@/components/ui/button'
import type { Bid } from '@/hooks/useBids'
import { getBidClientName } from '@/lib/supabase/types'

function formatCurrencyRaw(value: number): string {
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
    'Scope Awarded',
    'Scope Estimator',
    'Branch',
    'Estimator',
    'Bid Price',
    'Status',
    'Bid Due Date',
    'Project Start Date',
    'Notes',
  ]

  const rows = bids.map((bid) => {
    const lineItems = bid.line_items ?? []

    // Dedupe by scope while preserving the original row order so the three
    // per-scope columns line up index-by-index.
    const seen = new Set<string>()
    const orderedItems = lineItems.filter((li) => {
      if (seen.has(li.scope)) return false
      seen.add(li.scope)
      return true
    })

    const clients = (bid.clients ?? []).map(getBidClientName).filter(Boolean).join('; ')
    const scopes = orderedItems.map((li) => li.scope).join('; ')
    const scopeAwarded = orderedItems.map((li) => (li.is_awarded ? 'Yes' : 'No')).join('; ')
    const scopeEstimator = orderedItems
      .map((li) =>
        li.estimator_id
          ? li.estimator_name ?? 'Unknown'
          : bid.estimator_name ?? 'Unassigned',
      )
      .join('; ')
    const hasPrice = lineItems.some((li) => li.price !== null)
    return [
      bid.project_name,
      clients,
      scopes,
      scopeAwarded,
      scopeEstimator,
      bid.branch,
      bid.estimator_name ?? 'Unassigned',
      hasPrice ? formatCurrencyRaw(bid.total_price ?? 0) : 'TBD',
      bid.status,
      formatDateRaw(bid.bid_due_date),
      formatDateRaw(bid.project_start_date),
      bid.notes ?? '',
    ]
  })

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const dateStr = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bidwatt-bids-${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SpreadsheetPage() {
  const { bids, loading, error, patchBid, removeBid, refreshBids } = useBids()
  const { profile, isAdmin, isBranchManager } = useUserRole()
  const canSeeAllEstimators = isAdmin || isBranchManager

  const [estimatorFilter, setEstimatorFilter] = useState<EstimatorFilter>('mine')
  const [estimators, setEstimators] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!canSeeAllEstimators) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setEstimators(data as { id: string; name: string }[])
      })
  }, [canSeeAllEstimators])

  const visibleBids = useMemo(() => {
    if (estimatorFilter === 'all') return bids
    if (estimatorFilter === 'unassigned') return bids.filter((b) => b.estimator_id === null)
    if (estimatorFilter === 'mine') return bids.filter((b) => b.estimator_id === profile?.id)
    return bids.filter((b) => b.estimator_id === estimatorFilter)
  }, [bids, estimatorFilter, profile?.id])

  const topBar = (
    <div className="flex items-center justify-between">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Bid Board</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => exportToCsv(visibleBids)}
          disabled={loading || visibleBids.length === 0}
        >
          <DownloadIcon />
          Export CSV
        </Button>
        <NewBidDialog />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-4">
      {error && (
        <div className="error-card">
          Error loading bids: {error}
        </div>
      )}

      <DataTable
        bids={visibleBids}
        loading={loading}
        topBar={topBar}
        estimatorFilter={estimatorFilter}
        onEstimatorFilterChange={setEstimatorFilter}
        estimators={estimators}
        canSeeAllEstimators={canSeeAllEstimators}
        patchBid={patchBid}
        removeBid={removeBid}
        refreshBids={refreshBids}
      />
    </div>
  )
}
