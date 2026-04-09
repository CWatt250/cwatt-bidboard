'use client'

import { useState } from 'react'
import { useUserRole } from '@/contexts/userRole'
import { AdminDashboard, type TimeRange } from '@/components/dashboard/AdminDashboard'
import { BranchManagerDashboard } from '@/components/dashboard/BranchManagerDashboard'
import { EstimatorDashboard } from '@/components/dashboard/EstimatorDashboard'

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'This Month', value: 'this-month' },
  { label: 'This Quarter', value: 'this-quarter' },
  { label: 'This Year', value: 'this-year' },
  { label: 'All Time', value: 'all-time' },
]

export default function DashboardPage() {
  const { isAdmin, isBranchManager, loading } = useUserRole()
  const [timeRange, setTimeRange] = useState<TimeRange>('this-month')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse" style={{ borderRadius: 8 }} />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ height: 96, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="animate-pulse" style={{ height: 240, borderRadius: 'var(--radius)' }} />
          <div className="animate-pulse" style={{ height: 240, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Dashboard
        </h1>
        {/* Global Time Range Filter */}
        <div
          style={{
            display: 'inline-flex',
            background: 'white',
            border: '0.5px solid var(--border)',
            borderRadius: '8px',
            padding: '2px',
            gap: '2px',
          }}
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              style={{
                fontSize: '13px',
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: '6px',
                border:
                  timeRange === opt.value
                    ? '0.5px solid var(--border)'
                    : '0.5px solid transparent',
                background: timeRange === opt.value ? 'var(--surface2)' : 'transparent',
                color: timeRange === opt.value ? 'var(--text)' : 'var(--text3)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                lineHeight: 1.5,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isAdmin ? (
        <AdminDashboard timeRange={timeRange} />
      ) : isBranchManager ? (
        <BranchManagerDashboard />
      ) : (
        <EstimatorDashboard />
      )}
    </div>
  )
}
