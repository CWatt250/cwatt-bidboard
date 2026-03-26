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
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage users, branches, and system settings
            </p>
          </div>

          <div className="border-b">
            <nav className="flex gap-1 -mb-px">
              {ADMIN_TABS.map(({ href, label }) => {
                const isActive =
                  pathname === href || (label === 'Users' && pathname === '/dashboard/admin')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    }`}
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
