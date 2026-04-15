'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBidDetail } from '@/contexts/bidDetail'
import { useUserRole } from '@/contexts/userRole'
import { logActivity } from '@/lib/activity'
import type { Bid } from '@/hooks/useBids'
import { getBidClientName } from '@/lib/supabase/types'

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Plumbing Piping': { bg: 'rgba(56,189,248,0.12)', text: '#0ea5e9' },
  'HVAC Piping':     { bg: 'rgba(6,182,212,0.12)',  text: '#06b6d4' },
  'HVAC Ductwork':   { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
  'Fire Stopping':   { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  'Equipment':       { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' },
  'Other':           { bg: 'rgba(148,163,184,0.12)', text: '#64748b' },
}

/** Returns due-date badge info: null = omit, else pill props */
function getDueBadge(dateStr: string | null): { label: string; bg: string; color: string } | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return { label: 'Due Today', bg: '#FCEBEB', color: '#A32D2D' }
  if (diffDays >= 1 && diffDays <= 5) return { label: 'Due Soon', bg: '#FAEEDA', color: '#854F0B' }
  return null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface BidCardProps {
  bid: Bid
  index: number
  currentUserId: string | null
}

export function BidCard({ bid, index, currentUserId }: BidCardProps) {
  const { openBid } = useBidDetail()
  const { profile } = useUserRole()
  const [claiming, setClaiming] = useState(false)

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    setClaiming(true)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('bids')
      .update({ estimator_id: currentUserId, status: 'Bidding' })
      .eq('id', bid.id)
    setClaiming(false)
    if (updateError) {
      toast.error('Failed to claim bid. Please try again.')
      return
    }
    if (profile) {
      await logActivity(bid.id, profile.id, 'Status changed from Unassigned to Bidding')
    }
  }

  const lineItems = bid.line_items ?? []
  const bidClients = bid.clients ?? []
  const clientNames = bidClients.map(getBidClientName).filter(Boolean)
  const clientsDisplay =
    clientNames.length === 0
      ? null
      : clientNames.length === 1
        ? clientNames[0]
        : `${clientNames[0]} +${clientNames.length - 1}`

  const uniqueScopes = [...new Set(lineItems.map((li) => li.scope))]
  const extraScopes = uniqueScopes.length > 2 ? uniqueScopes.length - 2 : 0
  const hasPrice = lineItems.some((li) => li.price !== null)
  const totalPriceDisplay = hasPrice ? formatCurrency(bid.total_price ?? 0) : 'TBD'

  const dueBadge = getDueBadge(bid.bid_due_date)
  const dueDateFormatted = bid.bid_due_date ? formatDate(bid.bid_due_date) : null

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
            transition: snapshot.isDragging ? undefined : 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
          }}
          onMouseEnter={(e) => {
            if (!snapshot.isDragging) {
              const el = e.currentTarget as HTMLElement
              el.style.boxShadow = '0 6px 20px rgba(56,189,248,0.28), 0 2px 8px rgba(0,0,0,0.08)'
              el.style.borderColor = 'var(--accent)'
              el.style.transform = 'translateY(-2px)'
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
          <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, color: 'var(--text)', marginBottom: 3 }}>
            {bid.project_name}
          </div>

          {/* GC / client name */}
          {clientsDisplay && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 7 }}>
              {clientsDisplay}
            </div>
          )}

          {/* Scope + branch tags row */}
          {(uniqueScopes.length > 0 || bid.branch) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {uniqueScopes.slice(0, 2).map((scope) => {
                const c = SCOPE_COLORS[scope] ?? { bg: 'var(--surface2)', text: 'var(--text2)' }
                return (
                  <span
                    key={scope}
                    style={{
                      background: c.bg,
                      color: c.text,
                      fontSize: '0.63rem',
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
                  fontSize: '0.63rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}>
                  +{extraScopes}
                </span>
              )}
              {bid.branch && (
                <span style={{
                  background: 'var(--surface2)',
                  color: 'var(--text2)',
                  fontSize: '0.63rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}>
                  {bid.branch}
                </span>
              )}
            </div>
          )}

          {/* Bottom row: bid value left, due date right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-mono), "IBM Plex Mono", monospace',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: hasPrice ? 'var(--accent2)' : 'var(--text3)',
            }}>
              {totalPriceDisplay}
            </span>

            {/* Due date badge or muted text */}
            {dueBadge ? (
              <span style={{
                background: dueBadge.bg,
                color: dueBadge.color,
                fontSize: '0.63rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '100px',
                flexShrink: 0,
              }}>
                {dueBadge.label}
              </span>
            ) : dueDateFormatted ? (
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', flexShrink: 0 }}>
                {dueDateFormatted}
              </span>
            ) : null}
          </div>

          {/* Claim button — Unassigned only */}
          {bid.status === 'Unassigned' && (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
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
