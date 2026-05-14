'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import type { Bid } from '@/lib/supabase/types'
import type { AtRiskSummary, BranchBreakdownItem, WeekRange, WeekTotals } from '@/lib/recap-aggregations'
import { AtRiskCallout } from './AtRiskCallout'
import { BidsTable } from './BidsTable'
import { QuickTotalsRail } from './QuickTotalsRail'

interface MeetingModeProps {
  open: boolean
  onClose: () => void
  lastWeek: WeekRange
  thisWeek: WeekRange
  lastWeekBids: Bid[]
  thisWeekBids: Bid[]
  lastWeekTotals: WeekTotals
  thisWeekTotals: WeekTotals
  securedLastWeek: WeekTotals
  verbalsLastWeek: WeekTotals
  branchBreakdown: BranchBreakdownItem[]
  atRisk: AtRiskSummary
  lastWeekSentCount: number
  thisWeekSentCount: number
}

const SCALE = 1.4

export function MeetingMode(props: MeetingModeProps) {
  const {
    open,
    onClose,
    lastWeek,
    thisWeek,
    lastWeekBids,
    thisWeekBids,
    lastWeekTotals,
    thisWeekTotals,
    securedLastWeek,
    verbalsLastWeek,
    branchBreakdown,
    atRisk,
    lastWeekSentCount,
    thisWeekSentCount,
  } = props

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    // Lock background scroll while the overlay is up.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const lastRange = `${format(lastWeek.start, 'MMM d')} – ${format(lastWeek.end, 'MMM d')}`
  const thisRange = `${format(thisWeek.start, 'MMM d')} – ${format(thisWeek.end, 'MMM d')}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly Recap Meeting Mode"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#0b1220',
        color: '#e2e8f0',
        overflow: 'auto',
        padding: '32px 40px 48px',
      }}
    >
      <style>{`
        [role="dialog"][aria-label="Weekly Recap Meeting Mode"] {
          --surface: #111c2e;
          --surface2: #0f1a2a;
          --bg: #0b1220;
          --border: rgba(148, 163, 184, 0.18);
          --text: #f8fafc;
          --text2: #cbd5e1;
          --text3: #94a3b8;
        }
      `}</style>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              fontSize: `${11 * SCALE}px`,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#94a3b8',
            }}
          >
            Weekly Recap · Meeting Mode
          </p>
          <h1
            style={{
              fontSize: `${28 * SCALE}px`,
              fontWeight: 700,
              color: '#f8fafc',
              marginTop: 4,
              letterSpacing: '-0.5px',
            }}
          >
            {lastRange} vs {thisRange}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(148, 163, 184, 0.12)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#e2e8f0',
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: `${14 * SCALE / 1.1}px`,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <X size={18} aria-hidden="true" />
          Exit Meeting Mode (Esc)
        </button>
      </header>

      {atRisk.count > 0 && (
        <div style={{ marginBottom: 24 }}>
          <AtRiskCallout summary={atRisk} scale={SCALE} />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(420px, 460px)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <BidsTable
            title="Bids due last week"
            subtitle={`${lastRange} · ${lastWeekTotals.count} bid${lastWeekTotals.count === 1 ? '' : 's'} · ${formatCurrency(lastWeekTotals.total)} · ${lastWeekSentCount} sent`}
            bids={lastWeekBids}
            scale={SCALE}
          />
          <BidsTable
            title="Bids due this week"
            subtitle={`${thisRange} · ${thisWeekTotals.count} bid${thisWeekTotals.count === 1 ? '' : 's'} · ${formatCurrency(thisWeekTotals.total)} · ${thisWeekSentCount} sent`}
            bids={thisWeekBids}
            scale={SCALE}
          />
        </div>
        <QuickTotalsRail
          lastWeek={lastWeekTotals}
          thisWeek={thisWeekTotals}
          secured={securedLastWeek}
          verbals={verbalsLastWeek}
          branchBreakdown={branchBreakdown}
          inline
          scale={SCALE}
        />
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}
