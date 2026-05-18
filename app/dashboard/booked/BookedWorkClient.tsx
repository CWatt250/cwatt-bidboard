'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'
import { BranchLane } from './BranchLane'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { JobCard } from './JobCard'
import { SummaryBanner } from './SummaryBanner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const BRANCH_ORDER: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

/** Sentinel <Select> value for the "no client filter" option. */
const ALL_CLIENTS = '__all_clients__'

const BID_QUERY = `
  id,
  project_name,
  branch,
  estimator_id,
  status,
  bid_due_date,
  project_start_date,
  notes,
  created_at,
  updated_at,
  profiles!bids_estimator_id_fkey(name),
  bid_line_items(*),
  bid_clients(*, clients(name))
`

interface BookedBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

type Status = 'loading' | 'error' | 'success'

const centeredMessageStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 200,
  color: 'var(--text3)',
  fontSize: '0.875rem',
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
      <Search
        size={14}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text3)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        placeholder="Search projects..."
        aria-label="Search projects"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 34,
          padding: '0 30px',
          fontSize: '0.8125rem',
          color: 'var(--text)',
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function BookedWorkClient() {
  const [bids, setBids] = useState<BookedBid[]>([])
  const [userName, setUserName] = useState('You')
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('branch')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setError('You are not signed in.')
          setStatus('error')
        }
        return
      }

      // Personal view: only bids where the logged-in user is the estimator.
      const [bidsRes, profileRes] = await Promise.all([
        supabase
          .from('bids')
          .select(BID_QUERY)
          .in('status', ['Awarded', 'Verbal'])
          .eq('estimator_id', user.id)
          .order('bid_due_date', { ascending: false }),
        supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      ])

      if (cancelled) return

      if (bidsRes.error) {
        setError(bidsRes.error.message)
        setStatus('error')
        return
      }

      // The query returns line items under `bid_line_items`; map them onto
      // `line_items` and precompute `total_price` so cards/lanes can read a
      // real value instead of an undefined field (which previously read $0).
      const mapped = (((bidsRes.data as unknown) as any[]) ?? []).map((b: any) => {
        const line_items = (b.bid_line_items ?? []) as BidLineItem[]
        const total_price = line_items.reduce((sum, li) => sum + (li.price ?? 0), 0)
        return {
          ...b,
          estimator_name: b.profiles?.name ?? null,
          line_items,
          total_price,
        }
      }) as BookedBid[]

      setBids(mapped)
      setUserName(profileRes.data?.name ?? mapped[0]?.estimator_name ?? user.email ?? 'You')
      setStatus('success')
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Loading ----
  if (status === 'loading') {
    return <div style={centeredMessageStyle}>Loading booked work...</div>
  }

  // ---- Error ----
  if (status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          gap: 8,
        }}
      >
        <p style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 500 }}>
          Failed to load booked work
        </p>
        <p style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{error}</p>
      </div>
    )
  }

  // ---- Derived (summary reflects all bids; search only filters the cards) ----
  const awardedCount = bids.filter((b) => b.status === 'Awarded').length
  const verbalCount = bids.filter((b) => b.status === 'Verbal').length
  const totalValue = bids.reduce((sum, b) => sum + (b.total_price ?? 0), 0)

  // Unique client names across all loaded bids — feeds the client filter dropdown.
  const clientNames = Array.from(
    new Set(
      bids.flatMap((b) =>
        (b.bid_clients ?? [])
          .map((c) => c.clients?.name ?? c.client_name ?? '')
          .filter((n) => n !== ''),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b))

  // A bid is visible only when it matches BOTH the search text and the client filter.
  const q = searchQuery.trim().toLowerCase()
  const matches = (b: BookedBid) => {
    if (q !== '' && !b.project_name.toLowerCase().includes(q)) return false
    if (
      selectedClient !== null &&
      !(b.bid_clients ?? []).some(
        (c) => (c.clients?.name ?? c.client_name ?? '') === selectedClient,
      )
    ) {
      return false
    }
    return true
  }

  // ---- Branch-lanes view ----
  function renderBranchLanes() {
    return BRANCH_ORDER.map((branch) => {
      const branchBids = bids.filter((b) => b.branch === branch)
      // Skip branches with no booked work at all; keep lanes that merely got
      // emptied by the search (they render a header + empty strip).
      if (branchBids.length === 0) return null
      return <BranchLane key={branch} branch={branch} bids={branchBids.filter(matches)} />
    })
  }

  // ---- By-estimator view ----
  function renderByEstimator() {
    const visible = bids.filter(matches)
    const grouped = new Map<string, BookedBid[]>()
    for (const b of visible) {
      const key = b.estimator_id ?? 'unassigned'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(b)
    }
    const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length)

    if (entries.length === 0) {
      return <div style={centeredMessageStyle}>No projects match your search.</div>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {entries.map(([key, estimatorBids]) => {
          const name = estimatorBids[0]?.estimator_name ?? 'Unassigned'
          return (
            <div key={key}>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: 10,
                  paddingLeft: 4,
                }}
              >
                {name}
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text3)',
                    fontWeight: 400,
                    marginLeft: 8,
                  }}
                >
                  {estimatorBids.length} job{estimatorBids.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 4px 8px' }}>
                {estimatorBids.map((bid) => (
                  <JobCard key={bid.id} bid={bid} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ---- Sort-by-value view ----
  function renderByValue() {
    const sorted = bids
      .filter(matches)
      .slice()
      .sort((a, b) => (b.total_price ?? 0) - (a.total_price ?? 0))

    if (sorted.length === 0) {
      return <div style={centeredMessageStyle}>No projects match your search.</div>
    }

    return (
      <div style={{ display: 'flex', gap: 10, padding: '4px 4px 8px', flexWrap: 'wrap' }}>
        {sorted.map((bid) => (
          <JobCard key={bid.id} bid={bid} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Page header — title left, search + view toggle right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}
        >
          Booked Work
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
          <Select
            value={selectedClient ?? ALL_CLIENTS}
            onValueChange={(v) =>
              setSelectedClient(v && v !== ALL_CLIENTS ? String(v) : null)
            }
          >
            <SelectTrigger className="w-[200px]" aria-label="Filter by client">
              <SelectValue placeholder="Filter by client..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLIENTS}>All clients</SelectItem>
              {clientNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Personal summary banner */}
      <SummaryBanner
        userName={userName}
        awardedCount={awardedCount}
        verbalCount={verbalCount}
        totalValue={totalValue}
      />

      {/* Content */}
      {bids.length === 0 ? (
        <div style={centeredMessageStyle}>No awarded or verbal bids assigned to you yet.</div>
      ) : (
        <div>
          {viewMode === 'branch' && renderBranchLanes()}
          {viewMode === 'estimator' && renderByEstimator()}
          {viewMode === 'value' && renderByValue()}
        </div>
      )}
    </div>
  )
}
