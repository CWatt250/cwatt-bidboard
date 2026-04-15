'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DownloadIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  deleteBidDocument,
  getBidDocumentUrl,
  uploadBidDocument,
} from '@/lib/supabase/storage'
import type { BidDocument } from '@/lib/supabase/types'
import { useUserRole } from '@/contexts/userRole'
import { Button } from '@/components/ui/button'
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

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp'

function formatSize(n: number | null): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FileTypeIcon({ type, className }: { type: string | null; className?: string }) {
  const t = (type ?? '').toLowerCase()
  if (t.startsWith('image/')) return <ImageIcon className={className} />
  if (t.includes('pdf')) return <FileTextIcon className={className} />
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv'))
    return <FileSpreadsheetIcon className={className} />
  if (t.includes('word') || t.includes('document')) return <FileTextIcon className={className} />
  return <FileIcon className={className} />
}

interface DocumentsSectionProps {
  bidId: string
}

export function DocumentsSection({ bidId }: DocumentsSectionProps) {
  const { profile, isAdmin } = useUserRole()
  const [documents, setDocuments] = useState<BidDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BidDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bid_documents')
      .select('*')
      .eq('bid_id', bidId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load documents.')
      setLoading(false)
      return
    }
    setDocuments((data ?? []) as BidDocument[])
    setLoading(false)
  }, [bidId])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!profile) {
      toast.error('You must be signed in to upload.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    let succeeded = 0
    for (const file of Array.from(files)) {
      try {
        await uploadBidDocument(supabase, bidId, file, profile.id)
        succeeded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        toast.error(`${file.name}: ${msg}`)
      }
    }
    setUploading(false)
    if (succeeded > 0) {
      toast.success(
        succeeded === 1 ? 'Document uploaded.' : `${succeeded} documents uploaded.`
      )
      await fetchDocuments()
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDownload(doc: BidDocument) {
    try {
      const supabase = createClient()
      const url = await getBidDocumentUrl(supabase, doc.file_path)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      toast.error(msg)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    try {
      const supabase = createClient()
      await deleteBidDocument(supabase, pendingDelete)
      toast.success('Document deleted.')
      setPendingDelete(null)
      await fetchDocuments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast.error(msg)
    }
  }

  function canDelete(doc: BidDocument): boolean {
    if (!profile) return false
    return isAdmin || doc.uploaded_by === profile.id
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '20px 16px',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragging ? 'rgba(56,189,248,0.06)' : 'var(--surface)',
          transition: 'all 150ms ease',
        }}
      >
        <UploadCloudIcon
          className="mx-auto mb-1.5"
          size={22}
          style={{ color: 'var(--text3)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          {uploading
            ? 'Uploading…'
            : 'Drop files here or click to upload'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          PDF, Word, Excel, images
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
          Loading documents…
        </p>
      ) : documents.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
          No documents yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 px-3 py-2"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
              }}
            >
              <FileTypeIcon
                type={doc.file_type}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ color: 'var(--text)', fontWeight: 500 }}
                  title={doc.file_name}
                >
                  {doc.file_name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  {formatSize(doc.file_size)}
                  {doc.file_size != null ? ' · ' : ''}
                  {formatDate(doc.created_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleDownload(doc)}
                title="Download"
                aria-label={`Download ${doc.file_name}`}
              >
                <DownloadIcon className="size-4" />
              </Button>
              {canDelete(doc) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(doc)}
                  title="Delete"
                  aria-label={`Delete ${doc.file_name}`}
                >
                  <Trash2Icon className="size-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{pendingDelete?.file_name}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
