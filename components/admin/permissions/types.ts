export interface Role {
  id: string
  key: string
  name: string
  description: string | null
  is_system_role: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  module: string
  action: string
  key: string
  description: string | null
}

export interface RolePermission {
  id: string
  role_id: string
  permission_key: string
  allowed: boolean
}

export interface UserOverride {
  id: string
  user_id: string
  branch_id: string | null
  permission_key: string
  allowed: boolean
  reason: string | null
  created_at: string
}

export interface UserRoleAssignment {
  id: string
  user_id: string
  role_id: string
  branch_id: string
  created_at: string
  roles?: { key: string; name: string }
}

/** Module display config for the permission matrix */
export const MODULES: Array<{
  key: string
  label: string
  actions: string[]
}> = [
  { key: 'dashboard',      label: 'Dashboard',       actions: ['view'] },
  { key: 'workspace',      label: 'My Workspace',    actions: ['view', 'claim', 'move_status', 'reassign'] },
  { key: 'bid_board',      label: 'Bid Board',       actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'project_detail', label: 'Project Detail',  actions: ['view', 'edit'] },
  { key: 'calendar',       label: 'Calendar',        actions: ['view'] },
  { key: 'users',          label: 'Users',           actions: ['view', 'edit'] },
  { key: 'branches',       label: 'Branches',        actions: ['view', 'edit'] },
  { key: 'reports',        label: 'Reports',         actions: ['view', 'export'] },
  { key: 'permissions',    label: 'Permissions',     actions: ['view', 'edit'] },
  { key: 'system',         label: 'System',          actions: ['admin'] },
]

/** All possible column headers for the permission matrix */
export const ACTION_COLUMNS = [
  'view', 'create', 'edit', 'delete', 'claim', 'move_status', 'reassign', 'export', 'admin',
] as const

export const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  claim: 'Claim',
  move_status: 'Move Status',
  reassign: 'Reassign',
  export: 'Export',
  admin: 'Admin',
}
