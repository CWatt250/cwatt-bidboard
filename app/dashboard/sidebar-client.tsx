'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Table2, Calendar, Settings } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilters, type Branch, type Scope, type Status } from '@/contexts/filters'
import { useUserRole } from '@/contexts/userRole'
import { createClient } from '@/lib/supabase/client'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import type { Branch as BranchType } from '@/lib/supabase/types'

const ALL_BRANCHES: BranchType[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']
const SCOPES: Scope[] = ['All', 'Plumbing Piping', 'HVAC Piping', 'HVAC Ductwork', 'Fire Stopping', 'Equipment', 'Other']
const STATUSES: Status[] = ['All', 'Unassigned', 'Bidding', 'In Progress', 'Sent', 'Awarded', 'Lost']

const navLinks = [
  { href: '/dashboard/kanban', label: 'Kanban', Icon: LayoutGrid },
  { href: '/dashboard/spreadsheet', label: 'Spreadsheet', Icon: Table2 },
  { href: '/dashboard/calendar', label: 'Calendar', Icon: Calendar },
]

interface Profile {
  id: string
  name: string
  branches?: string[]
}

export function Sidebar({ profiles }: { profiles: Profile[] }) {
  const pathname = usePathname()
  const { branch, estimator, scope, status, setBranch, setEstimator, setScope, setStatus } = useFilters()
  const { isAdmin, isBranchManager, isEstimator, branches: userBranches, loading } = useUserRole()

  // Build branch options based on role
  const branchOptions: { value: Branch; label: string }[] = (() => {
    if (loading) return []
    if (isAdmin) {
      return [
        { value: 'All', label: 'All Branches' },
        ...ALL_BRANCHES.map((b) => ({ value: b as Branch, label: BRANCH_LABELS[b] })),
      ]
    }
    if (isBranchManager) {
      return [
        { value: 'All', label: 'All My Branches' },
        ...userBranches.map((b) => ({ value: b as Branch, label: BRANCH_LABELS[b] })),
      ]
    }
    // Estimator: only their branches, no "All" option
    return userBranches.map((b) => ({ value: b as Branch, label: BRANCH_LABELS[b] }))
  })()

  // Build estimator options based on role
  const estimatorOptions: Profile[] = (() => {
    if (isAdmin) return profiles
    if (isBranchManager) {
      return profiles.filter((p) =>
        p.branches?.some((pb) => userBranches.includes(pb as BranchType))
      )
    }
    return []
  })()

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-card border-r flex flex-col z-10">
      <div className="px-4 py-5 border-b">
        <span className="font-semibold text-sm tracking-tight">cwatt-bidboard</span>
      </div>

      <nav className="px-2 py-4 space-y-1">
        {navLinks.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === '/dashboard/admin'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings size={16} />
            Admin
          </Link>
        )}
      </nav>

      <div className="px-4 py-4 border-t space-y-3 flex-1 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Branch</label>
          <Select value={branch} onValueChange={(v) => setBranch((v ?? 'All') as Branch)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branchOptions.map((b) => (
                <SelectItem key={b.value} value={b.value} className="text-xs">{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isEstimator && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Estimator</label>
            <Select value={estimator} onValueChange={(v) => setEstimator(v ?? 'All')}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-xs">All</SelectItem>
                {estimatorOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Scope</label>
          <Select value={scope} onValueChange={(v) => setScope((v ?? 'All') as Scope)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus((v ?? 'All') as Status)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </aside>
  )
}

export function TopBar({ userName }: { userName: string }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-60 right-0 h-14 bg-background border-b flex items-center justify-between px-6 z-10">
      <span className="text-sm font-medium">{userName}</span>
      <button
        onClick={handleSignOut}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
