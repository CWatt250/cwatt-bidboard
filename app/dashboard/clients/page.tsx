'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
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
import { Label } from '@/components/ui/label'

interface ClientRow {
  id: string
  name: string
  created_at: string
  primaryContact: string | null
  bidCount: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchClients() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, created_at, client_contacts(name, created_at), bid_clients(id)')
      .order('name', { ascending: true })

    if (error) {
      toast.error('Failed to load clients.')
      setLoading(false)
      return
    }

    const mapped: ClientRow[] = (data ?? []).map((row: any) => {
      const contacts = (row.client_contacts ?? []) as Array<{
        name: string
        created_at: string
      }>
      const primary =
        contacts.length > 0
          ? [...contacts].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].name
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

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Clients
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your client relationships
          </p>
        </div>

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
                {saving ? 'Saving…' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-12"
          style={{ border: '0.5px dashed var(--border)' }}
        >
          <Users className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {search ? 'No clients match your search.' : 'No clients yet — add your first one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/clients/${c.id}`}
              className="flex flex-col gap-2 rounded-xl p-4 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--card)',
                border: '0.5px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {c.name}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {c.bidCount} {c.bidCount === 1 ? 'bid' : 'bids'}
                </span>
                <span>Added {formatDate(c.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {c.primaryContact ? `Primary: ${c.primaryContact}` : 'No contacts yet'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
