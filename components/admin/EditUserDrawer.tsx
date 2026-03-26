'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useUserRole } from '@/contexts/userRole'
import { updateUserProfile } from '@/app/actions/adminUsers'
import type { AdminUser } from '@/hooks/useAdminUsers'
import type { Branch, UserRole } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_BRANCHES: Branch[] = ['PSC', 'SEA', 'POR', 'PHX', 'SLC']

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['estimator', 'branch_manager', 'admin']),
    branches: z.array(z.string()).min(0),
    is_active: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if ((val.role === 'estimator' || val.role === 'branch_manager') && val.branches.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one branch is required for this role',
        path: ['branches'],
      })
    }
  })

type FormValues = z.infer<typeof schema>

interface EditUserDrawerProps {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditUserDrawer({ user, open, onClose, onSaved }: EditUserDrawerProps) {
  const { profile: currentProfile } = useUserRole()
  const isSelf = !!user && !!currentProfile && user.id === currentProfile.id
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      role: 'estimator',
      branches: [],
      is_active: true,
    },
  })

  const selectedBranches = watch('branches')
  const selectedRole = watch('role')
  const isActive = watch('is_active')

  // Pre-populate when user changes
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        role: user.role,
        branches: user.branches,
        is_active: user.is_active,
      })
    }
  }, [user, reset])

  function toggleBranch(branch: Branch) {
    const current = selectedBranches ?? []
    const next = current.includes(branch)
      ? current.filter((b) => b !== branch)
      : [...current, branch]
    setValue('branches', next, { shouldValidate: true })
  }

  async function onSubmit(values: FormValues) {
    if (!user) return
    setSaving(true)
    try {
      await updateUserProfile({
        userId: user.id,
        name: values.name,
        role: values.role,
        branches: values.branches,
        is_active: values.is_active,
      })
      toast.success(`${values.name} updated successfully`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-[420px] max-w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
        </SheetHeader>

        <form
          id="edit-user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
        >
          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} readOnly className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setValue('role', v as UserRole, { shouldValidate: true })}
              disabled={isSelf}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estimator">Estimator</SelectItem>
                <SelectItem value="branch_manager">Branch Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
            )}
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          {/* Branch Assignments */}
          <div className="space-y-2">
            <Label>Branch Assignments</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {ALL_BRANCHES.map((branch) => (
                <label
                  key={branch}
                  className="flex items-center gap-2.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={(selectedBranches ?? []).includes(branch)}
                    onChange={() => toggleBranch(branch)}
                    className="size-4 accent-primary rounded"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{branch}</span>
                    <span className="text-muted-foreground"> — {BRANCH_LABELS[branch]}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.branches && (
              <p className="text-xs text-destructive">{errors.branches.message}</p>
            )}
          </div>

          {/* Active/Inactive toggle */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                disabled={isSelf}
                onClick={() => !isSelf && setValue('is_active', !isActive, { shouldValidate: true })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm">{isActive ? 'Active' : 'Inactive'}</span>
              {isSelf && (
                <span className="text-xs text-muted-foreground">(cannot deactivate yourself)</span>
              )}
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button form="edit-user-form" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
