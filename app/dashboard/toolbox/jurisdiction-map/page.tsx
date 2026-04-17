'use client'

import dynamic from 'next/dynamic'

const JurisdictionMap = dynamic(
  () => import('@/components/toolbox/jurisdiction-map/JurisdictionMap'),
  { ssr: false, loading: () => <div className="h-[calc(100vh-12rem)] animate-pulse bg-gray-100 rounded-lg" /> }
)

export default function JurisdictionMapPage() {
  return <JurisdictionMap />
}
