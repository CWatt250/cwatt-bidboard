'use client'

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

/** Up to two initials from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: '6px 12px',
      }}
    >
      <span style={{ fontSize: '0.6875rem', color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: accent ? 'var(--green)' : 'var(--text)',
          fontFamily: accent ? 'var(--font-mono), monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Personal summary for the Booked Work page. Replaces the old org-wide
 * EstimatorScorestrip — this view only ever shows the logged-in user.
 */
export function SummaryBanner({
  userName,
  awardedCount,
  verbalCount,
  totalValue,
}: {
  userName: string
  awardedCount: number
  verbalCount: number
  totalValue: number
}) {
  const hasValue = totalValue > 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        background: 'var(--surface2)',
        borderRadius: 12,
        padding: 16,
        width: '100%',
      }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9375rem' }}>
            {initials(userName)}
          </span>
        </div>
        <div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.3,
            }}
          >
            Your booked work
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>
            {awardedCount} awarded · {verbalCount} verbal ·{' '}
            {hasValue ? formatCurrency(totalValue) : 'No prices yet'}
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Awarded" value={String(awardedCount)} />
        <Chip label="Verbal" value={String(verbalCount)} />
        <Chip
          label="Total Value"
          value={hasValue ? formatCurrency(totalValue) : 'TBD'}
          accent={hasValue}
        />
      </div>
    </div>
  )
}
