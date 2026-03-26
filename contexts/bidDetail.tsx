'use client'

import { createContext, useContext, useState } from 'react'
import type { Bid } from '@/hooks/useBids'

export type BidDetailProfile = { id: string; name: string }

interface BidDetailState {
  selectedBid: Bid | null
  profiles: BidDetailProfile[]
  openBid: (bid: Bid) => void
  closeBid: () => void
}

const BidDetailContext = createContext<BidDetailState | null>(null)

export function BidDetailProvider({
  children,
  profiles,
}: {
  children: React.ReactNode
  profiles: BidDetailProfile[]
}) {
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null)

  function openBid(bid: Bid) {
    setSelectedBid(bid)
  }

  function closeBid() {
    setSelectedBid(null)
  }

  return (
    <BidDetailContext.Provider value={{ selectedBid, profiles, openBid, closeBid }}>
      {children}
    </BidDetailContext.Provider>
  )
}

export function useBidDetail() {
  const ctx = useContext(BidDetailContext)
  if (!ctx) throw new Error('useBidDetail must be used within BidDetailProvider')
  return ctx
}
