'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUserRole } from '@/contexts/userRole'

const ADMIN_TABS = [
  { href: '/dashboard/admin/users', label: 'Users' },
  { href: '/dashboard/admin/branches', label: 'Branches' },
  { href: '/dashboard/admin/permissions', label: 'Permissions' },
  { href: '/dashboard/admin/reports', label: 'Reports' },
  { href: '/dashboard/admin/system', label: 'System' },
]

const REPORTS_PATH = '/dashboard/admin/reports'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isBranchManager, loading } = useUserRole()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (isAdmin) return
    // Branch managers may only access the reports page
    if (isBranchManager && pathname === REPORTS_PATH) return
    if (isBranchManager) {
      router.replace(REPORTS_PATH)
      return
    }
    // All others redirect to dashboard
    router.replace('/dashboard')
  }, [isAdmin, isBranchManager, loading, pathname, router])

  if (loading) return null
  if (!isAdmin && !isBranchManager) return null
  if (isBranchManager && pathname !== REPORTS_PATH) return null

  return (
    <div className="space-y-6">
      {/* Admin-only panel chrome — hidden for branch managers */}
      {isAdmin && (
        <>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>Admin Panel</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text3)', marginTop: 4 }}>
              Manage users, branches, and system settings
            </p>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <nav style={{ display: 'flex', gap: 4, marginBottom: -1 }}>
              {ADMIN_TABS.map(({ href, label }) => {
                const isActive =
                  pathname === href || (label === 'Users' && pathname === '/dashboard/admin')
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      borderBottom: `2px solid ${isActive ? '#38bdf8' : 'transparent'}`,
                      color: isActive ? '#38bdf8' : 'var(--text3)',
                      transition: 'all 150ms ease',
                      textDecoration: 'none',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}

      {children}
    </div>
  )
}
