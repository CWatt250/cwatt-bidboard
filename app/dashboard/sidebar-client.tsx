'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LayoutGrid, Table2, Calendar, Settings, Wrench, BarChart2 } from 'lucide-react'
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
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
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
    return userBranches.map((b) => ({ value: b as Branch, label: BRANCH_LABELS[b] }))
  })()

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
    <aside
      style={{
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
      }}
      className="fixed inset-y-0 left-0 w-60 flex flex-col z-10"
    >
      {/* Logo */}
      <div
        style={{ borderBottom: '1px solid var(--sb-border)' }}
        className="px-5 py-5 flex items-center gap-3"
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
            boxShadow: '0 0 12px rgba(56,189,248,0.4)',
            borderRadius: '8px',
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>B</span>
        </div>
        <span style={{ color: 'var(--sb-text)', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.3px' }}>
          cwatt-bidboard
        </span>
      </div>

      {/* Nav */}
      <nav className="px-2 py-4 space-y-0.5">
        {navLinks.map(({ href, label, Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 200ms ease',
                background: isActive ? 'var(--sb-active)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--sb-text2)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}

        {/* Toolbox */}
        {(() => {
          const isActive = pathname.startsWith('/dashboard/toolbox')
          return (
            <Link
              href="/dashboard/toolbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 200ms ease',
                background: isActive ? 'var(--sb-active)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--sb-text2)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Wrench size={15} />
              Toolbox
            </Link>
          )
        })()}

        {/* Reports (branch manager) */}
        {isBranchManager && (() => {
          const isActive = pathname === '/dashboard/admin/reports'
          return (
            <Link
              href="/dashboard/admin/reports"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 200ms ease',
                background: isActive ? 'var(--sb-active)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--sb-text2)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <BarChart2 size={15} />
              Reports
            </Link>
          )
        })()}

        {/* Admin */}
        {isAdmin && (() => {
          const isActive = pathname.startsWith('/dashboard/admin')
          return (
            <Link
              href="/dashboard/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 200ms ease',
                background: isActive ? 'var(--sb-active)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--sb-text2)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Settings size={15} />
              Admin
            </Link>
          )
        })()}
      </nav>

      {/* Filters */}
      <div
        style={{ borderTop: '1px solid var(--sb-border)' }}
        className="px-4 py-4 space-y-3 flex-1 overflow-y-auto"
      >
        <p style={{ color: 'var(--sb-text3)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Filters
        </p>

        <div className="space-y-1">
          <label style={{ color: 'var(--sb-text2)', fontSize: '0.75rem' }}>Branch</label>
          <Select value={branch} onValueChange={(v) => setBranch((v ?? 'All') as Branch)}>
            <SelectTrigger
              className="h-8 text-xs"
              style={{
                background: 'var(--sb-bg2)',
                border: '1px solid var(--sb-border)',
                color: 'var(--sb-text)',
                borderRadius: '6px',
              }}
            >
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
            <label style={{ color: 'var(--sb-text2)', fontSize: '0.75rem' }}>Estimator</label>
            <Select value={estimator} onValueChange={(v) => setEstimator(v ?? 'All')}>
              <SelectTrigger
                className="h-8 text-xs"
                style={{
                  background: 'var(--sb-bg2)',
                  border: '1px solid var(--sb-border)',
                  color: 'var(--sb-text)',
                  borderRadius: '6px',
                }}
              >
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
          <label style={{ color: 'var(--sb-text2)', fontSize: '0.75rem' }}>Scope</label>
          <Select value={scope} onValueChange={(v) => setScope((v ?? 'All') as Scope)}>
            <SelectTrigger
              className="h-8 text-xs"
              style={{
                background: 'var(--sb-bg2)',
                border: '1px solid var(--sb-border)',
                color: 'var(--sb-text)',
                borderRadius: '6px',
              }}
            >
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
          <label style={{ color: 'var(--sb-text2)', fontSize: '0.75rem' }}>Status</label>
          <Select value={status} onValueChange={(v) => setStatus((v ?? 'All') as Status)}>
            <SelectTrigger
              className="h-8 text-xs"
              style={{
                background: 'var(--sb-bg2)',
                border: '1px solid var(--sb-border)',
                color: 'var(--sb-text)',
                borderRadius: '6px',
              }}
            >
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
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      className="fixed top-0 left-60 right-0 h-16 flex items-center justify-between px-6 z-10"
    >
      <div className="flex items-center gap-3">
        {/* User avatar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.75rem' }}>
            {userName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.875rem' }}>{userName}</span>
      </div>
      <button
        onClick={handleSignOut}
        style={{
          color: 'var(--text3)',
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '6px 12px',
          borderRadius: '8px',
          transition: 'all 150ms ease',
          background: 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text3)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        }}
      >
        Sign out
      </button>
    </header>
  )
}
