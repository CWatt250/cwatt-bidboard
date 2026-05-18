'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Building2 } from 'lucide-react'
import type { Bid, BidLineItem, Branch } from '@/lib/supabase/types'

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

/** Traffic-light dot color for a due date relative to today. */
function dueColor(dateStr: string | null): string {
  if (!dateStr) return 'var(--text3)'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'var(--red)'
  if (days <= 14) return 'var(--orange)'
  return 'var(--green)'
}

interface JobCardBid extends Bid {
  line_items?: BidLineItem[]
  bid_clients?: { clients?: { name: string } | null; client_name?: string | null }[]
}

export function JobCard({ bid }: { bid: JobCardBid }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const lineItems = bid.line_items ?? []
  const totalValue = bid.total_price ?? lineItems.reduce((sum, li) => sum + (li.price ?? 0), 0)
  const hasValue = totalValue > 0

  const companyName =
    bid.bid_clients?.[0]?.clients?.name ?? bid.bid_clients?.[0]?.client_name ?? null

  const scopes = Array.from(new Set(lineItems.map((li) => li.scope)))
  const accent = BRANCH_COLORS[bid.branch]

  // Click-outside to collapse the inline scope panel
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${accent}0a` : 'var(--surface)',
        border: `0.5px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        minWidth: 260,
        maxWidth: 260,
        flexShrink: 0,
        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
        transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Card body — clicking navigates to the full project detail page */}
      <Link
        href={`/dashboard/bids/${bid.id}`}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
      >
        {/* Top accent bar — branch color */}
        <div style={{ height: 4, background: accent }} />

        {/* Body */}
        <div style={{ padding: '10px 14px 10px' }}>
          {/* Row 1: badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span
              style={{
                background: `${accent}18`,
                color: accent,
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
                background:
                  bid.status === 'Awarded' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
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

          {/* Row 2: project name — up to 2 lines */}
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={bid.project_name}
          >
            {bid.project_name}
          </div>

          {/* Row 3: client */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 5,
              fontSize: '0.75rem',
              color: 'var(--text3)',
            }}
          >
            <Building2 size={12} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {companyName ?? 'No client'}
            </span>
          </div>

          {/* Row 4: scope chips */}
          {scopes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {scopes.slice(0, 3).map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text2)',
                    background: 'var(--surface2)',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {s}
                </span>
              ))}
              {scopes.length > 3 && (
                <span style={{ fontSize: '0.625rem', color: 'var(--text3)', padding: '1px 4px' }}>
                  +{scopes.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer: value (left) + due date chip (right) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 14px',
            borderTop: '0.5px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            {hasValue ? (
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--green)',
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {formatCurrency(totalValue)}
              </span>
            ) : (
              <span style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--text3)' }}>
                TBD
              </span>
            )}
            {hovered && (
              <span
                style={{ fontSize: '0.625rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}
              >
                Open →
              </span>
            )}
          </div>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              fontSize: '0.6875rem',
              color: 'var(--text2)',
              background: 'var(--surface2)',
              padding: '2px 8px',
              borderRadius: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: dueColor(bid.bid_due_date),
                flexShrink: 0,
              }}
            />
            {bid.bid_due_date ? formatDate(bid.bid_due_date) : '—'}
          </span>
        </div>
      </Link>

      {/* Expand chevron — separate zone: peek at scopes without leaving the page */}
      <button
        type="button"
        aria-label={expanded ? 'Hide scope details' : 'Show scope details'}
        aria-expanded={expanded}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setExpanded((p) => !p)
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3px 0',
          border: 'none',
          borderTop: '0.5px solid var(--border)',
          background: 'transparent',
          color: 'var(--text3)',
          cursor: 'pointer',
        }}
      >
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Expanded line items */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '8px 14px 12px',
            borderTop: '0.5px solid var(--border)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6875rem' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '4px 4px',
                    fontWeight: 600,
                    color: 'var(--text2)',
                  }}
                >
                  Scope
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '4px 4px',
                    fontWeight: 600,
                    color: 'var(--text2)',
                  }}
                >
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length > 0 ? (
                lineItems.map((li) => (
                  <tr key={li.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '4px 4px', color: 'var(--text)' }}>{li.scope}</td>
                    <td
                      style={{
                        padding: '4px 4px',
                        textAlign: 'right',
                        color: 'var(--text)',
                        fontWeight: 500,
                      }}
                    >
                      {li.price ? formatCurrency(li.price) : 'TBD'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={2}
                    style={{ padding: '8px 4px', color: 'var(--text3)', textAlign: 'center' }}
                  >
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
