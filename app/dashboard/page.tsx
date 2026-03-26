'use client'

import { useUserRole } from '@/contexts/userRole'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { BranchManagerDashboard } from '@/components/dashboard/BranchManagerDashboard'
import { EstimatorDashboard } from '@/components/dashboard/EstimatorDashboard'

export default function DashboardPage() {
  const { isAdmin, isBranchManager, loading } = useUserRole()

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
    <div className="space-y-6">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Dashboard</h1>
      {isAdmin ? (
        <AdminDashboard />
      ) : isBranchManager ? (
        <BranchManagerDashboard />
      ) : (
        <EstimatorDashboard />
      )}
    </div>
  )
}
