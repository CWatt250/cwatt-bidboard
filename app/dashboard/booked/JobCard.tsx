'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'

const BRANCH_COLORS: Record<Branch, string> = {
  PSC: '#3b82f6',
  SEA: '#10b981',
  POR: '#f59e0b',
  PHX: '#ef4444',
  SLC: '#8b5cf6',
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(d))
}

interface JobCardBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

export function JobCard({ bid }: { bid: JobCardBid }) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const totalValue = bid.line_items?.reduce((sum, li) => sum + (li.price ?? 0), 0) ?? 0
  const companyName =
    bid.bid_clients?.[0]?.clients?.name ?? bid.bid_clients?.[0]?.client_name ?? null

  // Click-outside to collapse
  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded])

  return (
    <div
      ref={ref}
      onClick={() => setExpanded((p) => !p)}
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '12px 14px',
        cursor: 'pointer',
        minWidth: 210,
        maxWidth: 260,
        flexShrink: 0,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
      }}
      onMouseLeave={(e) => {
        if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            background: `${BRANCH_COLORS[bid.branch]}18`,
            color: BRANCH_COLORS[bid.branch],
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 4,
            letterSpacing: '0.02em',
          }}
        >
          {bid.branch}
        </span>
        <span
          style={{
            background: bid.status === 'Awarded' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
            color: bid.status === 'Awarded' ? '#10b981' : '#3b82f6',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          {bid.status}
        </span>
      </div>

      {/* Job name */}
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={bid.project_name}
      >
        {bid.project_name}
      </div>

      {/* Value */}
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        {formatCurrency(totalValue)}
      </div>

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: '0.6875rem',
          color: 'var(--text3)',
          marginTop: 2,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
          }}
        >
          {companyName ?? '—'}
        </span>
        <span style={{ flexShrink: 0 }}>
          {bid.bid_due_date ? formatDate(bid.bid_due_date) : '—'}
        </span>
      </div>

      {/* Expand indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 6,
          color: 'var(--text3)',
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <ChevronDown size={14} />
      </div>

      {/* Expanded line items */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '0.5px solid var(--border)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6875rem' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 4px', fontWeight: 600, color: 'var(--text2)' }}>
                  Scope
                </th>
                <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600, color: 'var(--text2)' }}>
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {bid.line_items && bid.line_items.length > 0 ? (
                bid.line_items.map((li) => (
                  <tr key={li.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '4px 4px', color: 'var(--text)' }}>{li.scope}</td>
                    <td style={{ padding: '4px 4px', textAlign: 'right', color: 'var(--text)', fontWeight: 500 }}>
                      {li.price ? formatCurrency(li.price) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} style={{ padding: '8px 4px', color: 'var(--text3)', textAlign: 'center' }}>
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
