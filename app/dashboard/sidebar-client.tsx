'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  LayoutGrid,
  Table2,
  Calendar,
  Contact,
  Settings,
  Wrench,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUserRole } from '@/contexts/userRole'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'bidwatt:sidebar-collapsed'
const EXPANDED_WIDTH = 192
const COLLAPSED_WIDTH = 56

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/dashboard/kanban', label: 'My Workspace', Icon: LayoutGrid },
  { href: '/dashboard/spreadsheet', label: 'Bid Board', Icon: Table2 },
  { href: '/dashboard/calendar', label: 'Calendar', Icon: Calendar },
  { href: '/dashboard/clients', label: 'Clients', Icon: Contact },
]

interface Profile {
  id: string
  name: string
  branches?: string[]
}

function setSidebarWidthVar(collapsed: boolean) {
  document.documentElement.style.setProperty(
    '--main-sidebar-width',
    collapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px`,
  )
}

interface NavItemProps {
  href: string
  label: string
  Icon: LucideIcon
  isActive: boolean
  collapsed: boolean
}

function NavItem({ href, label, Icon, isActive, collapsed }: NavItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '10px',
        padding: collapsed ? '8px 0' : '8px 12px',
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
      {!collapsed && label}
    </Link>
  )
}

export function Sidebar({ profiles: _profiles }: { profiles: Profile[] }) {
  const pathname = usePathname()
  const { isAdmin, isBranchManager, branches, profile } = useUserRole()
  const [collapsed, setCollapsed] = useState(false)

  // Read persisted state after mount to keep SSR markup stable
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial = stored === 'true'
    setCollapsed(initial)
    setSidebarWidthVar(initial)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      setSidebarWidthVar(next)
      return next
    })
  }

  return (
    <aside
      style={{
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        transition: 'width 200ms ease',
      }}
      className="fixed inset-y-0 left-0 flex flex-col z-10"
    >
      {/* Logo */}
      <div
        style={{ borderBottom: '1px solid var(--sb-border)' }}
        className={`${collapsed ? 'px-3 justify-center' : 'px-5'} py-5 flex items-center gap-3`}
      >
        <img
          src="/bidwatt-logo.svg"
          alt="BidWatt"
          style={{
            height: collapsed ? 32 : 40,
            width: 'auto',
            maxWidth: collapsed ? 32 : 40,
          }}
        />
        {!collapsed && (
          <span style={{ color: 'var(--sb-text)', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.3px' }}>
            BidWatt
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2 py-4 space-y-0.5 flex-1">
        {navLinks.map(({ href, label, Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            isActive={pathname === href}
            collapsed={collapsed}
          />
        ))}

        {/* Toolbox */}
        <NavItem
          href="/dashboard/toolbox"
          label="Toolbox"
          Icon={Wrench}
          isActive={pathname.startsWith('/dashboard/toolbox')}
          collapsed={collapsed}
        />

        {/* Reports (branch manager) */}
        {isBranchManager && (
          <NavItem
            href="/dashboard/admin/reports"
            label="Reports"
            Icon={BarChart2}
            isActive={pathname === '/dashboard/admin/reports'}
            collapsed={collapsed}
          />
        )}

        {/* Admin */}
        {isAdmin && (
          <NavItem
            href="/dashboard/admin"
            label="Admin"
            Icon={Settings}
            isActive={pathname.startsWith('/dashboard/admin')}
            collapsed={collapsed}
          />
        )}
      </nav>

      {/* User info + branch badges */}
      {profile && !collapsed && (
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

      {/* Collapse toggle */}
      <div
        style={{ borderTop: '1px solid var(--sb-border)' }}
        className={`shrink-0 ${collapsed ? 'px-2' : 'px-3'} py-3 flex ${collapsed ? 'justify-center' : 'justify-end'}`}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--sb-text2)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--sb-text2)'
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}

export function TopBar({ userName }: { userName: string }) {
  const router = useRouter()
  const { isAdmin, branches, loading } = useUserRole()

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
        left: 'var(--main-sidebar-width)',
        transition: 'left 200ms ease',
      }}
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 z-10"
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
        {!loading && (
          isAdmin ? (
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
          ) : branches.length > 0 ? (
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
          ) : null
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
