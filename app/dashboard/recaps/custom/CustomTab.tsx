'use client'

import { Construction } from 'lucide-react'

export function CustomTab() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        boxShadow: 'var(--shadow-sm)',
        padding: '64px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <Construction size={36} color="var(--text3)" aria-hidden="true" />
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.2px',
        }}
      >
        Coming soon
      </h3>
      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--text3)',
          maxWidth: 420,
        }}
      >
        Custom recap ranges will be available in a future update. You&apos;ll be
        able to compare any two date ranges side-by-side.
      </p>
    </div>
  )
}
