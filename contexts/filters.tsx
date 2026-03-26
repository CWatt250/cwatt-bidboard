'use client'

import { createContext, useContext, useState } from 'react'

export type Branch = 'All' | 'Branch 1' | 'Branch 2' | 'Branch 3' | 'Branch 4' | 'Branch 5'
export type Scope = 'All' | 'Ductwork' | 'Piping' | 'Firestop' | 'Combo'
export type Status = 'All' | 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent'

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
