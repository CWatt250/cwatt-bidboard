'use client'

import type { AdminUser } from '@/hooks/useAdminUsers'

interface EditUserDrawerProps {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

// Stub — fully implemented in Task 4
export function EditUserDrawer(_props: EditUserDrawerProps) {
  return null
}
