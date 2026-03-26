'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Table2, Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilters, type Branch, type Scope, type Status } from '@/contexts/filters'
import { createClient } from '@/lib/supabase/client'

const BRANCHES: Branch[] = ['All', 'Branch 1', 'Branch 2', 'Branch 3', 'Branch 4', 'Branch 5']
const SCOPES: Scope[] = ['All', 'Ductwork', 'Piping', 'Firestop', 'Combo']
const STATUSES: Status[] = ['All', 'Unassigned', 'Bidding', 'In Progress', 'Sent']

const navLinks = [
  { href: '/dashboard/kanban', label: 'Kanban', Icon: LayoutGrid },
  { href: '/dashboard/spreadsheet', label: 'Spreadsheet', Icon: Table2 },
  { href: '/dashboard/calendar', label: 'Calendar', Icon: Calendar },
]

interface Profile {
  id: string
  name: string
}

export function Sidebar({ profiles }: { profiles: Profile[] }) {
  const pathname = usePathname()
  const { branch, estimator, scope, status, setBranch, setEstimator, setScope, setStatus } = useFilters()

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
              {BRANCHES.map((b) => (
                <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Estimator</label>
          <Select value={estimator} onValueChange={(v) => setEstimator(v ?? 'All')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
