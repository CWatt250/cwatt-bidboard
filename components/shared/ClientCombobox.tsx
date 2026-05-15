'use client'

import { useState } from 'react'
import { ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface ClientComboboxProps {
  /** Existing client names — the autocomplete source. */
  clients: string[]
  /** Currently selected client name (the form field value). */
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Single-control client picker. Search existing clients with cmdk's fuzzy
 * matching, or create a new one from the typed text when nothing matches.
 * Either path writes a plain client-name string to the form field —
 * ensureClientId() resolves it to a clients row at submit time.
 */
export function ClientCombobox({
  clients,
  value,
  onChange,
  placeholder = 'Select or create client…',
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const typed = query.trim()

  function commit(name: string) {
    onChange(name)
    setQuery('')
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-8 w-full justify-between px-2.5 text-sm font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) min-w-0 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type a client…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {/* cmdk only renders CommandEmpty when nothing matched the filter,
                so the "create" action shows precisely when the typed name
                isn't an existing client. */}
            <CommandEmpty className="p-1">
              {typed ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(typed)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <PlusIcon className="size-3.5 shrink-0" />
                  <span className="truncate">
                    Create &ldquo;{typed}&rdquo; as new client
                  </span>
                </button>
              ) : (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No clients yet — type a name to create one.
                </p>
              )}
            </CommandEmpty>
            {clients.length > 0 && (
              <CommandGroup>
                {clients.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    data-checked={value === name}
                    onSelect={() => commit(name)}
                  >
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
