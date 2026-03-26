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
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
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
