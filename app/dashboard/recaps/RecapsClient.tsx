'use client'

import { useState } from 'react'
import { WeeklyTab } from './weekly/WeeklyTab'
import { CustomTab } from './custom/CustomTab'
import { InsightsTab } from './insights/InsightsTab'

type RecapTab = 'weekly' | 'custom' | 'insights'

const TABS: { id: RecapTab; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom' },
  { id: 'insights', label: 'Insights' },
]

export function RecapsClient() {
  const [tab, setTab] = useState<RecapTab>('weekly')

  return (
    <div className="space-y-4">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
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
          Recaps
        </h1>
        <div
          role="tablist"
          aria-label="Recap views"
          style={{
            display: 'inline-flex',
            background: 'white',
            border: '0.5px solid var(--border)',
            borderRadius: 8,
            padding: 2,
            gap: 2,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
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
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'weekly' && <WeeklyTab />}
        {tab === 'custom' && <CustomTab />}
        {tab === 'insights' && <InsightsTab />}
      </div>
    </div>
  )
}
