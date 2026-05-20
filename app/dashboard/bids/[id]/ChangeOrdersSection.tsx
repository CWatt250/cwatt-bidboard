'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BidChangeOrder, BidChangeOrderStatus } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddChangeOrderDialog } from './AddChangeOrderDialog'

const SCOPE_BADGE_CLASSES: Record<string, string> = {
  'Plumbing Piping': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'HVAC Piping': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'Refer Piping': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  'HVAC Ductwork': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'Fire Stopping': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'Equipment': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'Other': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
}

interface ChangeOrdersSectionProps {
  bidId: string
}

const STATUS_BADGE: Record<BidChangeOrderStatus, string> = {
  Pending:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  Approved:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  Rejected:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  // Parse YYYY-MM-DD as a local date to avoid off-by-one from UTC conversion.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ChangeOrdersSection({ bidId }: ChangeOrdersSectionProps) {
  const [cos, setCos] = useState<BidChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [projectName, setProjectName] = useState('')
  const [lineItemScopes, setLineItemScopes] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCo, setEditingCo] = useState<BidChangeOrder | undefined>(undefined)

  const fetchCos = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bid_change_orders')
      .select('*')
      .eq('bid_id', bidId)
      .order('co_number', { ascending: true })

    if (error) {
      toast.error('Failed to load change orders.')
      setLoading(false)
      return
    }
    setCos((data ?? []) as BidChangeOrder[])
    setLoading(false)
  }, [bidId])

  useEffect(() => {
    void fetchCos()
    const supabase = createClient()
    void supabase
      .from('bids')
      .select('project_name')
      .eq('id', bidId)
      .single()
      .then(({ data }) => {
        if (data?.project_name) setProjectName(data.project_name as string)
      })
    void supabase
      .from('bid_line_items')
      .select('scope')
      .eq('bid_id', bidId)
      .then(({ data }) => {
        const scopes = [...new Set((data ?? []).map((r) => r.scope as string).filter(Boolean))].sort()
        setLineItemScopes(scopes)
      })
  }, [bidId, fetchCos])

  function openNewDialog() {
    setEditingCo(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(co: BidChangeOrder) {
    setEditingCo(co)
    setDialogOpen(true)
  }

  async function handleDelete(co: BidChangeOrder, ev: React.MouseEvent) {
    ev.stopPropagation()
    if (!window.confirm(`Delete change order ${co.co_number}?`)) return

    // Optimistic remove
    const prev = cos
    setCos((rows) => rows.filter((r) => r.id !== co.id))

    const supabase = createClient()
    const { error } = await supabase.from('bid_change_orders').delete().eq('id', co.id)

    if (error) {
      setCos(prev)
      toast.error('Failed to delete change order.')
      return
    }
    toast.success('Change order deleted.')
  }

  const approvedTotal = cos
    .filter((c) => c.status === 'Approved')
    .reduce((sum, c) => sum + Number(c.value ?? 0), 0)
  const pendingTotal = cos
    .filter((c) => c.status === 'Pending')
    .reduce((sum, c) => sum + Number(c.value ?? 0), 0)

  const hasRows = cos.length > 0

  return (
    <Card className="shadow-[var(--shadow)] border border-[var(--border)] rounded-[var(--radius-lg)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-bold text-[var(--text)]">Change Orders</CardTitle>
          {hasRows && (
            <Button size="sm" type="button" onClick={openNewDialog}>
              <PlusIcon className="size-3.5 mr-1" />
              Add Change Order
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : !hasRows ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">No change orders yet</p>
            <Button size="sm" type="button" onClick={openNewDialog}>
              <PlusIcon className="size-3.5 mr-1" />
              Add Change Order
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">CO #</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[150px]">Scope</TableHead>
                  <TableHead className="text-right w-[110px]">Value</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cos.map((co) => (
                  <TableRow
                    key={co.id}
                    className="cursor-pointer"
                    onClick={() => openEditDialog(co)}
                  >
                    <TableCell className="font-medium">{co.co_number}</TableCell>
                    <TableCell>{formatDate(co.co_date)}</TableCell>
                    <TableCell className="max-w-[420px] truncate">
                      {co.description || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {co.scope ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SCOPE_BADGE_CLASSES[co.scope] ?? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'}`}
                        >
                          {co.scope}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">General</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
                    >
                      {formatCurrency(Number(co.value ?? 0))}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[co.status]}`}
                      >
                        {co.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        title="Delete change order"
                        onClick={(e) => void handleDelete(co, e)}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-end gap-6 border-t pt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Approved COs Total: </span>
                <span
                  className="font-semibold tabular-nums text-green-700 dark:text-green-300"
                  style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
                >
                  {formatCurrency(approvedTotal)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Pending COs Total: </span>
                <span
                  className="font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                  style={{ fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace' }}
                >
                  {formatCurrency(pendingTotal)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <AddChangeOrderDialog
        bidId={bidId}
        bidProjectName={projectName}
        existingCo={editingCo}
        bidLineItemScopes={lineItemScopes}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void fetchCos()}
      />
    </Card>
  )
}
