'use client'

import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ensureClientId } from '@/lib/clients'
import type { Bid } from '@/lib/supabase/types'
import { getBidClientName } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
} from '@/components/ui/popover'

interface ClientsPopoverProps {
  bid?: Bid
  /** Draft mode: parent owns state, popover never touches supabase. */
  draftMode?: boolean
  draftClients?: string[]
  onDraftSave?: (names: string[]) => void
  placeholder?: React.ReactNode
  triggerClassName?: string
}

export function ClientsPopover({
  bid,
  draftMode = false,
  draftClients,
  onDraftSave,
  placeholder,
  triggerClassName,
}: ClientsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [allClients, setAllClients] = useState<string[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  // Compute display string for trigger
  const bidClientNames: string[] = draftMode
    ? (draftClients ?? [])
    : (bid?.clients ?? []).map(getBidClientName).filter(Boolean)
  const display =
    bidClientNames.length === 0
      ? null
      : bidClientNames.length === 1
        ? bidClientNames[0]
        : `${bidClientNames[0]} +${bidClientNames.length - 1}`

  // When popover opens: fetch all unique client names + init checked set
  useEffect(() => {
    if (!open) return

    const currentNames = new Set(bidClientNames)
    setChecked(currentNames)
    setSearch('')
    setNewName('')

    async function fetchAllClients() {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('name')
        .order('name', { ascending: true })

      const names = (data ?? []).map((r: any) => r.name as string).filter(Boolean)
      // Also include current bid's clients in case they're not in the global list yet
      const merged = [...new Set([...names, ...currentNames])]
      merged.sort((a, b) => a.localeCompare(b))
      setAllClients(merged)
    }

    fetchAllClients()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleClient(name: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function handleSave() {
    if (draftMode) {
      onDraftSave?.([...checked])
      setOpen(false)
      return
    }

    if (!bid) return
    setSaving(true)
    const supabase = createClient()

    try {
      const currentNames = new Set(bidClientNames)

      // Names to add
      const toAdd = [...checked].filter((name) => !currentNames.has(name))
      // Names to remove
      const toRemove = [...currentNames].filter((name) => !checked.has(name))

      if (toAdd.length > 0) {
        const rows = await Promise.all(
          toAdd.map(async (client_name) => ({
            bid_id: bid.id,
            client_id: await ensureClientId(supabase, client_name),
            client_name,
          }))
        )
        const { error } = await supabase.from('bid_clients').insert(rows)
        if (error) throw error
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('bid_clients')
          .delete()
          .eq('bid_id', bid.id)
          .in('client_name', toRemove)
        if (error) throw error
      }

      toast.success('Clients updated.')
      setOpen(false)
    } catch {
      toast.error('Failed to update clients.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNew() {
    const trimmed = newName.trim()
    if (!trimmed) return

    // Add to allClients list and check it
    setAllClients((prev) => {
      const merged = [...new Set([...prev, trimmed])]
      merged.sort((a, b) => a.localeCompare(b))
      return merged
    })
    setChecked((prev) => new Set([...prev, trimmed]))
    setNewName('')
  }

  const filtered = allClients.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className={triggerClassName ?? 'w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors text-sm'}
            title="Click to manage clients"
          />
        }
      >
        {display ?? placeholder ?? <span className="italic text-muted-foreground">—</span>}
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" side="bottom" align="start">
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
            Manage Clients
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px 4px' }}>
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
        </div>

        {/* Client list */}
        <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 12px 4px' }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text3)', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
              {search ? 'No matches' : 'No clients yet'}
            </p>
          )}
          {filtered.map((name) => (
            <label
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 0',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(name)}
                onChange={() => toggleClient(name)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            </label>
          ))}
        </div>

        {/* Add new client */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <Input
            placeholder="New client name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew() } }}
            className="h-7 text-xs flex-1"
          />
          <button
            onClick={handleAddNew}
            disabled={!newName.trim()}
            title="Add new client"
            style={{
              padding: '0 8px',
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: newName.trim() ? 'pointer' : 'not-allowed',
              opacity: newName.trim() ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <PopoverClose
            render={
              <Button variant="outline" size="sm" style={{ height: 28, fontSize: '0.72rem' }} />
            }
          >
            Cancel
          </PopoverClose>
          <Button
            size="sm"
            style={{ height: 28, fontSize: '0.72rem' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
