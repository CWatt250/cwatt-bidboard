'use client'

import { AlertTriangleIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DuplicateBidMatch } from '@/hooks/useDuplicateProjectCheck'

interface DuplicateProjectWarningProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attemptedName: string
  existingBids: DuplicateBidMatch[]
  onCreateAnyway: () => void
  onCancel: () => void
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y}`
}

export function DuplicateProjectWarning({
  open,
  onOpenChange,
  attemptedName,
  existingBids,
  onCreateAnyway,
  onCancel,
}: DuplicateProjectWarningProps) {
  const count = existingBids.length
  const plural = count === 1 ? 'bid' : 'bids'
  const verb = count === 1 ? 'exists' : 'exist'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div
            className="-mx-4 -mt-4 flex items-center gap-2 rounded-t-xl border-b px-4 py-3"
            style={{
              background: '#FEF3C7',
              borderBottomColor: '#FCD34D',
              color: '#854F0B',
            }}
          >
            <AlertTriangleIcon className="size-4" />
            <DialogTitle style={{ color: '#854F0B' }}>Possible duplicate</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {count} {plural} already {verb} with the name &ldquo;
          <span className="font-medium text-foreground">{attemptedName}</span>
          &rdquo;. Review before creating:
        </p>

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {existingBids.map((bid) => (
            <a
              key={bid.id}
              href={`/dashboard/bids/${bid.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium text-foreground">
                  {bid.project_name}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline">{bid.branch}</Badge>
                  <Badge variant="secondary">{bid.status}</Badge>
                  <span>Due {formatDueDate(bid.bid_due_date)}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-primary">Open ↗</span>
            </a>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onCreateAnyway}>Create anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
