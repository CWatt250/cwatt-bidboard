'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { STATUS_BADGE_CLASSES, BRANCH_BADGE_CLASSES } from '@/config/colors'
import type { BidStatus, Branch } from '@/lib/supabase/types'

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
}

interface ClientBid {
  id: string
  project_name: string
  status: BidStatus
  branch: Branch
  bid_due_date: string
  total_price: number
}

interface ClientRecord {
  id: string
  name: string
  created_at: string
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const clientId = params.id

  const [client, setClient] = useState<ClientRecord | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bids, setBids] = useState<ClientBid[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Name edit state
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactDraft, setContactDraft] = useState<{
    name: string
    email: string
    phone: string
    title: string
  }>({ name: '', email: '', phone: '', title: '' })
  const [savingContact, setSavingContact] = useState(false)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name, created_at')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !clientData) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setClient(clientData as ClientRecord)

    const { data: contactData } = await supabase
      .from('client_contacts')
      .select('id, name, email, phone, title, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    setContacts((contactData ?? []) as Contact[])

    const { data: bidJoin } = await supabase
      .from('bid_clients')
      .select(
        'bids(id, project_name, status, branch, bid_due_date, bid_line_items(price))'
      )
      .eq('client_id', clientId)

    const mappedBids: ClientBid[] = []
    for (const row of (bidJoin ?? []) as any[]) {
      const b = row.bids
      if (!b) continue
      const total = ((b.bid_line_items ?? []) as Array<{ price: number | null }>).reduce(
        (sum, li) => sum + (li.price ?? 0),
        0
      )
      mappedBids.push({
        id: b.id,
        project_name: b.project_name,
        status: b.status,
        branch: b.branch,
        bid_due_date: b.bid_due_date,
        total_price: total,
      })
    }
    mappedBids.sort((a, b) => b.bid_due_date.localeCompare(a.bid_due_date))
    setBids(mappedBids)

    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function saveName() {
    if (!client) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === client.name) {
      setEditingName(false)
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('clients').update({ name: trimmed }).eq('id', client.id)
    if (error) {
      toast.error('Failed to rename client.')
      return
    }
    setClient({ ...client, name: trimmed })
    setEditingName(false)
    toast.success('Client renamed.')
  }

  function startAddContact() {
    setEditingContactId(null)
    setContactDraft({ name: '', email: '', phone: '', title: '' })
    setShowContactForm(true)
  }

  function startEditContact(c: Contact) {
    setEditingContactId(c.id)
    setContactDraft({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      title: c.title ?? '',
    })
    setShowContactForm(true)
  }

  function cancelContactForm() {
    setShowContactForm(false)
    setEditingContactId(null)
    setContactDraft({ name: '', email: '', phone: '', title: '' })
  }

  async function saveContact() {
    if (!contactDraft.name.trim()) return
    setSavingContact(true)
    const supabase = createClient()
    const payload = {
      name: contactDraft.name.trim(),
      email: contactDraft.email.trim() || null,
      phone: contactDraft.phone.trim() || null,
      title: contactDraft.title.trim() || null,
    }

    if (editingContactId) {
      const { error } = await supabase
        .from('client_contacts')
        .update(payload)
        .eq('id', editingContactId)
      setSavingContact(false)
      if (error) {
        toast.error('Failed to update contact.')
        return
      }
      toast.success('Contact updated.')
    } else {
      const { error } = await supabase
        .from('client_contacts')
        .insert({ client_id: clientId, ...payload })
      setSavingContact(false)
      if (error) {
        toast.error('Failed to add contact.')
        return
      }
      toast.success('Contact added.')
    }

    cancelContactForm()
    fetchAll()
  }

  async function deleteContact(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('client_contacts').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete contact.')
      return
    }
    toast.success('Contact deleted.')
    fetchAll()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/clients')}>
          <ArrowLeft className="size-3.5" />
          Back to Clients
        </Button>
        <p className="text-sm text-muted-foreground">Client not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Clients
      </Link>

      {/* Header: client name */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-9 max-w-md text-base font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveName()
                } else if (e.key === 'Escape') {
                  setEditingName(false)
                }
              }}
            />
            <Button size="sm" onClick={saveName}>
              <Check className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
              {client.name}
            </h1>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setNameDraft(client.name)
                setEditingName(true)
              }}
              title="Rename client"
            >
              <Pencil className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Contacts section */}
      <section
        className="rounded-xl p-4"
        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Contacts
          </h3>
          {!showContactForm && (
            <Button size="xs" variant="outline" onClick={startAddContact}>
              <Plus className="size-3" />
              Add Contact
            </Button>
          )}
        </div>

        {contacts.length === 0 && !showContactForm ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No contacts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg px-3 py-2"
                style={{ border: '0.5px solid var(--border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {c.name}
                    {c.title && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {c.title}
                      </span>
                    )}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => startEditContact(c)}
                    title="Edit contact"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="ghost" size="icon-xs" title="Delete contact">
                          <Trash2 className="size-3 text-red-400" />
                        </Button>
                      }
                    />
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove <strong>{c.name}</strong> from this client&apos;s contacts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => deleteContact(c.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {showContactForm && (
          <div
            className="mt-3 rounded-lg p-3 space-y-2"
            style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {editingContactId ? 'Edit Contact' : 'New Contact'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">
                  Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={contactDraft.name}
                  onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px]">Title</Label>
                <Input
                  value={contactDraft.title}
                  onChange={(e) => setContactDraft({ ...contactDraft, title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Email</Label>
                <Input
                  type="email"
                  value={contactDraft.email}
                  onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Phone</Label>
                <Input
                  value={contactDraft.phone}
                  onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="xs" variant="outline" onClick={cancelContactForm}>
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={saveContact}
                disabled={!contactDraft.name.trim() || savingContact}
              >
                {savingContact ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Bids section */}
      <section
        className="rounded-xl p-4"
        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          Bids ({bids.length})
        </h3>
        {bids.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No bids attached to this client yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: '0.5px solid var(--border)',
                    background: 'var(--surface2)',
                  }}
                >
                  {['Project', 'Status', 'Bid Value', 'Due Date', 'Branch'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/dashboard/bids/${b.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                  >
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>
                      {b.project_name}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[b.status] ?? ''}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: 'var(--text)' }}
                    >
                      {b.total_price > 0 ? formatCurrency(b.total_price) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(b.bid_due_date)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0 text-xs ${BRANCH_BADGE_CLASSES[b.branch] ?? ''}`}
                      >
                        {b.branch}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
