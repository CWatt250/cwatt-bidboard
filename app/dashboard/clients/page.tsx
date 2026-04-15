'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Users,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/contexts/userRole'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface PrimaryContact {
  name: string
  email: string | null
  phone: string | null
}

interface ClientRow {
  id: string
  name: string
  created_at: string
  primaryContact: PrimaryContact | null
  bidCount: number
}

type ViewMode = 'card' | 'list'
type SortMode = 'name-asc' | 'name-desc' | 'most-bids' | 'recent'

const VIEW_KEY = 'bidwatt:clients_view'
const SORT_KEY = 'bidwatt:clients_sort'

const SORT_LABELS: Record<SortMode, string> = {
  'name-asc': 'Name A–Z',
  'name-desc': 'Name Z–A',
  'most-bids': 'Most Bids',
  recent: 'Recently Added',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(rows: ClientRow[]) {
  const header = [
    'Client Name',
    'Bid Count',
    'Primary Contact Name',
    'Primary Contact Email',
    'Primary Contact Phone',
    'Date Added',
  ]
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push(
      [
        csvEscape(c.name),
        csvEscape(c.bidCount),
        csvEscape(c.primaryContact?.name ?? ''),
        csvEscape(c.primaryContact?.email ?? ''),
        csvEscape(c.primaryContact?.phone ?? ''),
        csvEscape(formatDate(c.created_at)),
      ].join(',')
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `bidwatt-clients-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ClientsPage() {
  const { isAdmin } = useUserRole()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [sortMode, setSortMode] = useState<SortMode>('name-asc')
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load preferences
  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = window.localStorage.getItem(VIEW_KEY)
    if (v === 'card' || v === 'list') setViewMode(v)
    const s = window.localStorage.getItem(SORT_KEY)
    if (s === 'name-asc' || s === 'name-desc' || s === 'most-bids' || s === 'recent') {
      setSortMode(s)
    }
  }, [])

  function updateViewMode(v: ViewMode) {
    setViewMode(v)
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_KEY, v)
  }

  function updateSortMode(s: SortMode) {
    setSortMode(s)
    if (typeof window !== 'undefined') window.localStorage.setItem(SORT_KEY, s)
  }

  async function fetchClients() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .select(
        'id, name, created_at, client_contacts(name, email, phone, created_at), bid_clients(id)'
      )
      .order('name', { ascending: true })

    if (error) {
      toast.error('Failed to load clients.')
      setLoading(false)
      return
    }

    const mapped: ClientRow[] = (data ?? []).map((row: any) => {
      const contacts = (row.client_contacts ?? []) as Array<{
        name: string
        email: string | null
        phone: string | null
        created_at: string
      }>
      const sorted = [...contacts].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      )
      const primary: PrimaryContact | null =
        sorted.length > 0
          ? { name: sorted[0].name, email: sorted[0].email, phone: sorted[0].phone }
          : null
      return {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        primaryContact: primary,
        bidCount: (row.bid_clients ?? []).length,
      }
    })

    setClients(mapped)
    setLoading(false)
  }

  useEffect(() => {
    fetchClients()
  }, [])

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('clients').insert({ name: trimmed })
    setSaving(false)
    if (error) {
      toast.error('Failed to add client.')
      return
    }
    toast.success('Client added.')
    setNewName('')
    setAddOpen(false)
    fetchClients()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete client.')
      return
    }
    toast.success(`${deleteTarget.name} deleted.`)
    setDeleteTarget(null)
    fetchClients()
  }

  const visible = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = clients.filter((c) => c.name.toLowerCase().includes(q))
    const sorted = [...filtered]
    switch (sortMode) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'most-bids':
        sorted.sort((a, b) => b.bidCount - a.bidCount || a.name.localeCompare(b.name))
        break
      case 'recent':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
        break
    }
    return sorted
  }, [clients, search, sortMode])

  function requestDelete(e: React.MouseEvent, c: ClientRow) {
    e.preventDefault()
    e.stopPropagation()
    setDeleteTarget(c)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Clients
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your client relationships
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <Select value={sortMode} onValueChange={(v) => v && updateSortMode(v as SortMode)}>
            <SelectTrigger size="sm" className="h-8 min-w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div
            className="inline-flex overflow-hidden rounded-lg"
            style={{ border: '0.5px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => updateViewMode('card')}
              title="Card view"
              aria-label="Card view"
              aria-pressed={viewMode === 'card'}
              className="flex h-8 w-8 items-center justify-center transition-colors"
              style={{
                background: viewMode === 'card' ? 'var(--surface2)' : 'transparent',
                color: viewMode === 'card' ? 'var(--text)' : 'var(--text3)',
              }}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateViewMode('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className="flex h-8 w-8 items-center justify-center transition-colors"
              style={{
                background: viewMode === 'list' ? 'var(--surface2)' : 'transparent',
                color: viewMode === 'list' ? 'var(--text)' : 'var(--text3)',
                borderLeft: '0.5px solid var(--border)',
              }}
            >
              <ListIcon className="size-3.5" />
            </button>
          </div>

          {/* Export CSV */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsv(visible)}
            disabled={visible.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>

          {/* Add */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="size-3.5" />
                  Add Client
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="client-name">Client name</Label>
                <Input
                  id="client-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Acme Mechanical"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAdd()
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!newName.trim() || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-12"
          style={{ border: '0.5px dashed var(--border)' }}
        >
          <Users className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {search ? 'No clients match your search.' : 'No clients yet — add your first one.'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <div key={c.id} className="relative">
              <Link
                href={`/dashboard/clients/${c.id}`}
                className="flex flex-col gap-2 rounded-xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--card)',
                  border: '0.5px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                <p
                  className="pr-8 text-sm font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {c.name}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.bidCount} {c.bidCount === 1 ? 'bid' : 'bids'}
                  </span>
                  <span>Added {formatDate(c.created_at)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.primaryContact
                    ? `Primary: ${c.primaryContact.name}`
                    : 'No contacts yet'}
                </p>
              </Link>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => requestDelete(e, c)}
                  title="Delete client"
                  aria-label={`Delete ${c.name}`}
                  className="absolute right-2 top-2"
                >
                  <Trash2 className="size-3 text-red-400" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: 'var(--surface2)',
                  borderBottom: '0.5px solid var(--border)',
                }}
              >
                {['Client Name', 'Bids', 'Primary Contact', 'Date Added'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
                {isAdmin && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  style={{ borderBottom: '0.5px solid var(--border)' }}
                  onClick={() => {
                    window.location.href = `/dashboard/clients/${c.id}`
                  }}
                >
                  <td
                    className="px-3 py-2 text-sm font-medium"
                    style={{ color: 'var(--text)' }}
                  >
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--text)', textDecoration: 'none' }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.bidCount}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.primaryContact?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(c.created_at)}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => requestDelete(e, c)}
                        title="Delete client"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="size-3 text-red-400" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.bidCount > 0 ? (
                <>
                  This client is attached to <strong>{deleteTarget.bidCount}</strong>{' '}
                  {deleteTarget.bidCount === 1 ? 'bid' : 'bids'}. Deleting will remove
                  them from those bids.
                </>
              ) : (
                <>
                  Remove <strong>{deleteTarget?.name}</strong> from your clients list.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
