'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ActivityEntry {
  id: string
  bid_id: string
  action: string
  created_at: string
  project_name: string | null
  author_name: string | null
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return 'just now'
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs !== 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-10 rounded bg-muted animate-pulse" />
      ))}
    </div>
  )
}

export function RecentActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchActivity() {
    const supabase = createClient()
    const { data } = await supabase
      .from('bid_activity')
      .select('id, bid_id, action, created_at, bids(id, project_name), profiles(name)')
      .order('created_at', { ascending: false })
      .limit(10)

    setEntries(
      (data ?? []).map((a: any) => ({
        id: a.id,
        bid_id: a.bid_id,
        action: a.action,
        created_at: a.created_at,
        project_name: a.bids?.project_name ?? null,
        author_name: a.profiles?.name ?? null,
      }))
    )
  }

  useEffect(() => {
    setLoading(true)
    fetchActivity().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('recent-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bid_activity' },
        () => fetchActivity()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-card border rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>

      {/* Content */}
      <div className="overflow-y-auto">
        {loading ? (
          <Skeleton />
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center px-4 py-6">
            No recent activity yet
          </p>
        ) : (
          <div className="p-2 space-y-0.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                {/* Action text */}
                <p className="text-xs text-foreground leading-snug">
                  {entry.action}
                  {entry.project_name && (
                    <>
                      {' '}—{' '}
                      <Link
                        href={`/dashboard/bids/${entry.bid_id}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.project_name}
                      </Link>
                    </>
                  )}
                </p>
                {/* Author + timestamp */}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.author_name ?? 'Unknown'} · {relativeTime(entry.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
