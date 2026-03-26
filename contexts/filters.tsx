'use client'

import { createContext, useContext, useState } from 'react'

export type Branch = 'All' | 'PSC' | 'SEA' | 'POR' | 'PHX' | 'SLC'
export type Scope = 'All' | 'Plumbing Piping' | 'HVAC Piping' | 'HVAC Ductwork' | 'Fire Stopping' | 'Equipment' | 'Other'
export type Status = 'All' | 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent' | 'Awarded' | 'Lost'

interface FiltersState {
  branch: Branch
  estimator: string
  scope: Scope
  status: Status
  setBranch: (v: Branch) => void
  setEstimator: (v: string) => void
  setScope: (v: Scope) => void
  setStatus: (v: Status) => void
}

const FiltersContext = createContext<FiltersState | null>(null)

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [branch, setBranch] = useState<Branch>('All')
  const [estimator, setEstimator] = useState<string>('All')
  const [scope, setScope] = useState<Scope>('All')
  const [status, setStatus] = useState<Status>('All')

  return (
    <FiltersContext.Provider value={{ branch, estimator, scope, status, setBranch, setEstimator, setScope, setStatus }}>
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider')
  return ctx
}
