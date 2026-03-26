'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import { createAuthUser } from '@/app/actions/adminUsers'
import type { Branch, UserRole } from '@/lib/supabase/types'
import { BRANCH_LABELS } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
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
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['estimator', 'branch_manager', 'admin']),
    branches: z.array(z.string()).min(0),
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

interface AddUserDialogProps {
  onCreated: () => void
}

export function AddUserDialog({ onCreated }: AddUserDialogProps) {
  const [open, setOpen] = useState(false)
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
      email: '',
      password: '',
      role: 'estimator',
      branches: [],
    },
  })

  const selectedBranches = watch('branches')
  const selectedRole = watch('role')

  function toggleBranch(branch: Branch) {
    const current = selectedBranches ?? []
    const next = current.includes(branch)
      ? current.filter((b) => b !== branch)
      : [...current, branch]
    setValue('branches', next, { shouldValidate: true })
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      await createAuthUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        branches: values.branches,
      })
      toast.success(`${values.name} added successfully`)
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        setOpen(v)
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon />
            Add User
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>

        <form id="add-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Display Name</Label>
            <Input id="new-name" {...register('name')} placeholder="Jane Smith" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" {...register('email')} placeholder="jane@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Temporary Password</Label>
            <Input id="new-password" type="password" {...register('password')} placeholder="Min 8 characters" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setValue('role', v as UserRole, { shouldValidate: true })}
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
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
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
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => { reset(); setOpen(false) }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button form="add-user-form" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
