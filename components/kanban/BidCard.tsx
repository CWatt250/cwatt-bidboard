'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import type { Bid } from '@/hooks/useBids'

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Plumbing Piping': { bg: 'rgba(56,189,248,0.12)', text: '#0ea5e9' },
  'HVAC Piping':     { bg: 'rgba(6,182,212,0.12)',  text: '#06b6d4' },
  'HVAC Ductwork':   { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
  'Fire Stopping':   { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  'Equipment':       { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' },
  'Other':           { bg: 'rgba(148,163,184,0.12)','text': '#64748b' },
}

function dueDateStyle(dateStr: string): React.CSSProperties {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return { color: 'var(--red)', fontWeight: 700 }
  if (diffDays <= 7) return { color: 'var(--yellow)', fontWeight: 600 }
  return { color: 'var(--text3)' }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

interface BidCardProps {
  bid: Bid
  index: number
  currentUserId: string | null
}

export function BidCard({ bid, index, currentUserId }: BidCardProps) {
  const { openBid } = useBidDetail()
  const [claiming, setClaiming] = useState(false)

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    setClaiming(true)
    const supabase = createClient()
    await supabase
      .from('bids')
      .update({ estimator_id: currentUserId, status: 'Bidding' })
      .eq('id', bid.id)
    setClaiming(false)
  }

  const lineItems = bid.line_items ?? []
  const uniqueClients = [...new Set(lineItems.map((li) => li.client))]
  const clientsDisplay =
    uniqueClients.length === 0
      ? null
      : uniqueClients.slice(0, 2).join(', ') +
        (uniqueClients.length > 2 ? ` +${uniqueClients.length - 2} more` : '')

  const uniqueScopes = [...new Set(lineItems.map((li) => li.scope))]
  const extraScopes = uniqueScopes.length > 2 ? uniqueScopes.length - 2 : 0
  const hasPrice = lineItems.some((li) => li.price !== null)
  const totalPriceDisplay = hasPrice ? formatCurrency(bid.total_price ?? 0) : 'TBD'

  return (
    <Draggable draggableId={bid.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => openBid(bid)}
          style={{
            ...provided.draggableProps.style,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            cursor: 'pointer',
            userSelect: 'none',
            boxShadow: snapshot.isDragging
              ? '0 8px 24px rgba(56,189,248,0.25), 0 2px 8px rgba(0,0,0,0.08)'
              : 'var(--shadow-sm)',
            transform: snapshot.isDragging
              ? `${provided.draggableProps.style?.transform ?? ''} rotate(1.5deg)`
              : provided.draggableProps.style?.transform,
            opacity: snapshot.isDragging ? 0.95 : 1,
            transition: snapshot.isDragging ? undefined : 'box-shadow 150ms ease, transform 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!snapshot.isDragging) {
              const el = e.currentTarget as HTMLElement
              el.style.boxShadow = '0 4px 16px rgba(56,189,248,0.2), 0 1px 4px rgba(0,0,0,0.06)'
              el.style.borderColor = 'var(--accent-border)'
              el.style.transform = 'translateY(-1px)'
            }
          }}
          onMouseLeave={(e) => {
            if (!snapshot.isDragging) {
              const el = e.currentTarget as HTMLElement
              el.style.boxShadow = 'var(--shadow-sm)'
              el.style.borderColor = 'var(--border)'
              el.style.transform = 'translateY(0)'
            }
          }}
        >
          {/* Project name */}
          <div style={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.3, color: 'var(--text)', marginBottom: 4 }}>
            {bid.project_name}
          </div>

          {/* Clients */}
          {clientsDisplay && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 6 }}>
              {clientsDisplay}
            </div>
          )}

          {/* Scope badges */}
          {uniqueScopes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {uniqueScopes.slice(0, 2).map((scope) => {
                const c = SCOPE_COLORS[scope] ?? { bg: 'var(--surface2)', text: 'var(--text2)' }
                return (
                  <span
                    key={scope}
                    style={{
                      background: c.bg,
                      color: c.text,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {scope}
                  </span>
                )
              })}
              {extraScopes > 0 && (
                <span style={{
                  background: 'var(--surface2)',
                  color: 'var(--text3)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}>
                  +{extraScopes}
                </span>
              )}
              <span style={{
                background: 'var(--surface2)',
                color: 'var(--text2)',
                fontSize: '0.65rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                {bid.branch}
              </span>
            </div>
          )}

          {/* Estimator */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4 }}>
            {bid.estimator_name ?? <em>Unassigned</em>}
          </div>

          {/* Due date */}
          <div style={{ fontSize: '0.72rem', marginBottom: 4, ...dueDateStyle(bid.bid_due_date) }}>
            Due: {new Date(bid.bid_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          {/* Price */}
          <div style={{
            fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: hasPrice ? 'var(--accent2)' : 'var(--text3)',
            marginBottom: bid.status === 'Unassigned' ? 8 : 0,
          }}>
            {totalPriceDisplay}
          </div>

          {/* Claim button */}
          {bid.status === 'Unassigned' && (
            <div onClick={(e) => e.stopPropagation()}>
              <button
                disabled={claiming || !currentUserId}
                onClick={handleClaim}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: claiming || !currentUserId ? 'not-allowed' : 'pointer',
                  background: claiming ? 'var(--surface2)' : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                  color: claiming ? 'var(--text3)' : 'white',
                  border: 'none',
                  boxShadow: claiming ? 'none' : '0 4px 14px rgba(56,189,248,0.35)',
                  transition: 'all 150ms ease',
                  opacity: !currentUserId ? 0.5 : 1,
                }}
              >
                {claiming ? 'Claiming…' : 'Claim'}
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
