'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ensureClientId } from '@/lib/clients'
import { logActivity } from '@/lib/activity'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import type { BidBranch, BidScope, BidStatus } from '@/lib/supabase/types'
import { parseLooseDate } from '@/lib/utils'
import { TableCell, TableRow } from '@/components/ui/table'
import { ScopeEditor, type DraftItem } from './ScopeEditor'
import { AutocompleteCell } from './AutocompleteCell'

const BRANCHES: BidBranch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const STATUSES: BidStatus[] = ['Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']

interface GhostState {
  project_name: string
  scopes: DraftItem[]
  bid_due_date: string
  estimator_id: string | null
  clients: string[]
  branch: BidBranch | ''
  notes: string
  status: BidStatus
}

const EMPTY_GHOST: GhostState = {
  project_name: '',
  scopes: [],
  bid_due_date: '',
  estimator_id: null,
  clients: [],
  branch: '',
  notes: '',
  status: 'Bidding',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
}

const cellSelectStyle: React.CSSProperties = {
  ...cellInputStyle,
  appearance: 'none',
  cursor: 'pointer',
}

interface GhostRowProps {
  visibleColumnIds: string[]
}

export function GhostRow({ visibleColumnIds }: GhostRowProps) {
  const { profiles } = useBidDetail()
  const { profile } = useUserRole()
  const [ghost, setGhost] = useState<GhostState>(() => ({
    ...EMPTY_GHOST,
    estimator_id: profile?.id ?? null,
  }))
  const [dueDateText, setDueDateText] = useState('')
  const [saving, setSaving] = useState(false)
  const [allClientNames, setAllClientNames] = useState<string[]>([])
  const projectNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('clients')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (data) setAllClientNames(data.map((r) => r.name))
      })
  }, [])

  function normalizeDueDate() {
    if (!dueDateText.trim()) {
      setGhost((g) => ({ ...g, bid_due_date: '' }))
      return
    }
    const iso = parseLooseDate(dueDateText)
    if (iso) {
      const [y, m, d] = iso.split('-')
      setDueDateText(`${m}/${d}/${y}`)
      setGhost((g) => ({ ...g, bid_due_date: iso }))
    }
  }

  const totalPrice = ghost.scopes.reduce((sum, s) => {
    const p = parseFloat(s.price)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)
  const hasPrice = ghost.scopes.some((s) => {
    const p = parseFloat(s.price)
    return !isNaN(p)
  })

  function reset() {
    setGhost({ ...EMPTY_GHOST, estimator_id: profile?.id ?? null })
    setDueDateText('')
  }

  function handleEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      reset()
    }
  }

  async function commit() {
    if (saving) return
    if (!ghost.project_name.trim()) {
      toast.error('Project name is required.')
      projectNameRef.current?.focus()
      return
    }
    if (!ghost.branch) {
      toast.error('Branch is required.')
      return
    }
    const isoDue = ghost.bid_due_date || parseLooseDate(dueDateText)
    if (!isoDue) {
      toast.error('Bid due date is required.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { data: bidData, error: bidError } = await supabase
      .from('bids')
      .insert({
        project_name: ghost.project_name.trim(),
        branch: ghost.branch,
        estimator_id: ghost.status === 'Unassigned' ? null : ghost.estimator_id,
        status: ghost.status,
        bid_due_date: isoDue,
        notes: ghost.notes.trim() || null,
      })
      .select('id')
      .single()

    if (bidError || !bidData) {
      setSaving(false)
      toast.error('Failed to create bid.')
      return
    }
    const bidId = bidData.id

    if (profile) await logActivity(bidId, profile.id, 'Created bid')

    const lineItems = ghost.scopes
      .filter((s) => s.scope !== '')
      .map((s) => {
        const n = parseFloat(s.price)
        return {
          bid_id: bidId,
          scope: s.scope as BidScope,
          price: s.price.trim() ? (isNaN(n) ? null : n) : null,
          client: '',
        }
      })
    if (lineItems.length > 0) {
      const { error: liErr } = await supabase.from('bid_line_items').insert(lineItems)
      if (liErr) {
        console.error('[GhostRow] line item insert failed', liErr)
        toast.error(`Scope pricing not saved: ${liErr.message}`)
      }
    }

    if (ghost.clients.length > 0) {
      const rows = await Promise.all(
        ghost.clients.map(async (client_name) => ({
          bid_id: bidId,
          client_id: await ensureClientId(supabase, client_name),
          client_name,
        }))
      )
      const { error: cErr } = await supabase.from('bid_clients').insert(rows)
      if (cErr) {
        toast.error(`Clients not saved: ${cErr.message}`)
      }
    }

    setSaving(false)
    toast.success('Bid created.')
    window.dispatchEvent(new Event('bidwatt:bid-created'))
    reset()
    // Refocus the first cell so the row stays the entry point
    setTimeout(() => projectNameRef.current?.focus(), 0)
  }

  function renderCell(colId: string) {
    switch (colId) {
      case 'project_name':
        return (
          <input
            ref={projectNameRef}
            type="text"
            value={ghost.project_name}
            placeholder="Start typing a project name…"
            onChange={(e) => setGhost((g) => ({ ...g, project_name: e.target.value }))}
            onKeyDown={handleEnter}
            className="ghost-cell-input"
            style={cellInputStyle}
          />
        )

      case 'scope':
        return (
          <ScopeEditor
            draftMode
            draftItems={ghost.scopes}
            onDraftSave={(items) => setGhost((g) => ({ ...g, scopes: items }))}
            placeholder={<span className="italic text-muted-foreground text-xs">Select scopes…</span>}
            triggerClassName="w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors min-h-[28px] flex items-center"
          />
        )

      case 'total_price':
        return (
          <span
            style={{ fontWeight: 500, fontSize: 15 }}
            className={hasPrice ? '' : 'italic text-muted-foreground'}
          >
            {hasPrice ? formatCurrency(totalPrice) : 'TBD'}
          </span>
        )

      case 'bid_due_date':
        return (
          <input
            type="text"
            value={dueDateText}
            placeholder="MM/DD/YYYY"
            onChange={(e) => setDueDateText(e.target.value)}
            onBlur={normalizeDueDate}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                normalizeDueDate()
                return
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                normalizeDueDate()
                void commit()
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                reset()
              }
            }}
            className="ghost-cell-input"
            style={cellInputStyle}
          />
        )

      case 'estimator_name':
        return (
          <select
            value={ghost.estimator_id ?? ''}
            onChange={(e) =>
              setGhost((g) => ({ ...g, estimator_id: e.target.value || null }))
            }
            onKeyDown={handleEnter}
            className="ghost-cell-input"
            style={cellSelectStyle}
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )

      case 'client':
        return (
          <AutocompleteCell
            options={allClientNames}
            selected={ghost.clients}
            onSelect={(value) =>
              setGhost((g) => ({ ...g, clients: [...g.clients, value] }))
            }
            onRemove={(value) =>
              setGhost((g) => ({ ...g, clients: g.clients.filter((c) => c !== value) }))
            }
            placeholder="Select clients..."
            allowAdd
            onKeyDown={handleEnter}
            renderSelected={(sel) => (
              <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                {sel.length === 1 ? sel[0] : `${sel[0]} +${sel.length - 1}`}
              </span>
            )}
          />
        )

      case 'branch':
        return (
          <select
            value={ghost.branch}
            onChange={(e) =>
              setGhost((g) => ({ ...g, branch: e.target.value as BidBranch | '' }))
            }
            onKeyDown={handleEnter}
            className="ghost-cell-input"
            style={cellSelectStyle}
          >
            <option value="">Branch…</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )

      case 'notes':
        return (
          <input
            type="text"
            value={ghost.notes}
            placeholder="Add notes…"
            onChange={(e) => setGhost((g) => ({ ...g, notes: e.target.value }))}
            onKeyDown={handleEnter}
            className="ghost-cell-input"
            style={cellInputStyle}
          />
        )

      case 'status':
        return (
          <select
            value={ghost.status}
            onChange={(e) =>
              setGhost((g) => ({ ...g, status: e.target.value as BidStatus }))
            }
            onKeyDown={handleEnter}
            className="ghost-cell-input"
            style={cellSelectStyle}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )

      case 'actions':
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              title="Clear (Esc)"
              aria-label="Clear row"
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XIcon size={12} />
            </button>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={saving}
              title="Save (Enter)"
              aria-label="Save row"
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: 'none',
                background: '#378ADD',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckIcon size={12} />
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <style>{`
        .ghost-cell-input:focus {
          border-bottom: 2px solid #378add !important;
        }
      `}</style>
      <TableRow
        style={{
          borderTop: '2px dashed var(--accent-border)',
          background: 'var(--surface)',
        }}
      >
        {visibleColumnIds.map((colId) => (
          <TableCell
            key={colId}
            style={{ color: 'var(--text)', fontSize: '0.8rem', verticalAlign: 'middle' }}
          >
            {renderCell(colId)}
          </TableCell>
        ))}
      </TableRow>
    </>
  )
}
