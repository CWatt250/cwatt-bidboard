'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LayoutGrid, Table2, Calendar, Settings, Wrench, BarChart2 } from 'lucide-react'
import { useUserRole } from '@/contexts/userRole'
import { createClient } from '@/lib/supabase/client'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/dashboard/kanban', label: 'My Workspace', Icon: LayoutGrid },
  { href: '/dashboard/spreadsheet', label: 'Bid Board', Icon: Table2 },
  { href: '/dashboard/calendar', label: 'Calendar', Icon: Calendar },
]

interface Profile {
  id: string
  name: string
  branches?: string[]
}

export function Sidebar({ profiles: _profiles }: { profiles: Profile[] }) {
  const pathname = usePathname()
  const { isAdmin, isBranchManager, branches, profile } = useUserRole()

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
          BidWatt
        </span>
      </div>

      {/* Nav */}
      <nav className="px-2 py-4 space-y-0.5 flex-1">
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

      {/* User info + branch badges */}
      {profile && (
        <div
          style={{ borderTop: '1px solid var(--sb-border)' }}
          className="px-4 py-3 shrink-0"
        >
          <p style={{ color: 'var(--sb-text)', fontSize: '0.75rem', fontWeight: 600 }} className="truncate mb-1.5">
            {profile.name}
          </p>
          <div className="flex flex-wrap gap-1">
            {isAdmin && branches.length >= 5 ? (
              <span
                style={{
                  background: 'rgba(56,189,248,0.12)',
                  color: '#38bdf8',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.02em',
                }}
              >
                All Branches
              </span>
            ) : (
              branches.map((b) => (
                <span
                  key={b}
                  style={{
                    background: 'var(--sb-hover)',
                    color: 'var(--sb-text2)',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {b}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

export function TopBar({ userName }: { userName: string }) {
  const router = useRouter()
  const { isAdmin, branches } = useUserRole()

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
        {isAdmin && branches.length >= 5 ? (
          <span
            style={{
              background: 'rgba(56,189,248,0.12)',
              color: '#38bdf8',
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.02em',
            }}
          >
            All Branches
          </span>
        ) : (
          branches.map((b) => (
            <span
              key={b}
              style={{
                background: 'var(--surface2)',
                color: 'var(--text2)',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.02em',
              }}
            >
              {b}
            </span>
          ))
        )}
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
