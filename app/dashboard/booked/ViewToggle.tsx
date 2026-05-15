'use client'

export type ViewMode = 'branch' | 'estimator' | 'value'

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'branch', label: 'Branch lanes' },
  { id: 'estimator', label: 'By estimator' },
  { id: 'value', label: 'Sort by value' },
]

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Booked work view"
      style={{
        display: 'inline-flex',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}
    >
      {VIEWS.map((v) => {
        const active = value === v.id
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '4px 14px',
              borderRadius: 6,
              border: active ? '0.5px solid var(--border)' : '0.5px solid transparent',
              background: active ? 'var(--surface2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              lineHeight: 1.5,
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
