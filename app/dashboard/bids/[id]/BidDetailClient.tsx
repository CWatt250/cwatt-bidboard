'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import { useBid } from '@/hooks/useBid'
import { Skeleton } from '@/components/ui/skeleton'

export default function BidDetailClient({ bidId }: { bidId: string }) {
  const router = useRouter()
  const { bid, loading, notFound } = useBid(bidId)

  useEffect(() => {
    if (!loading && notFound) {
      router.replace('/dashboard')
    }
  }, [loading, notFound, router])

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-80" />
        {/* Title skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-6 w-20" />
        </div>
        {/* Status buttons skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        {/* Three column layout skeleton */}
        <div className="grid grid-cols-[5fr_3fr_2fr] gap-6 mt-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!bid) return null

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          My Workspace
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="text-foreground font-medium truncate">{bid.project_name}</span>
      </nav>

      <h1 className="text-2xl font-bold">{bid.project_name}</h1>
    </div>
  )
}
