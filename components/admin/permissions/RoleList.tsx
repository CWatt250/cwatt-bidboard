'use client'

import { Shield, ShieldCheck, Eye, User } from 'lucide-react'
import type { Role } from './types'

const ROLE_ICONS: Record<string, React.ReactNode> = {
  system_admin: <ShieldCheck className="size-4 text-blue-500" />,
  branch_manager: <Shield className="size-4 text-emerald-500" />,
  estimator: <User className="size-4 text-amber-500" />,
  viewer: <Eye className="size-4 text-gray-400" />,
}

interface RoleListProps {
  roles: Role[]
  selectedRoleId: string | null
  onSelectRole: (role: Role) => void
}

export function RoleList({ roles, selectedRoleId, onSelectRole }: RoleListProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Roles
      </p>
      {roles.map((role) => {
        const isActive = role.id === selectedRoleId
        return (
          <button
            key={role.id}
            onClick={() => onSelectRole(role)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer"
            style={{
              background: isActive ? 'var(--accent)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text)' : 'var(--text3)',
            }}
          >
            {ROLE_ICONS[role.key] ?? <Shield className="size-4 text-gray-400" />}
            <div className="flex flex-col">
              <span>{role.name}</span>
              {role.description && (
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {role.description}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
