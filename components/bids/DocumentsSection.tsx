'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  SearchIcon,
  Trash2Icon,
  UploadCloudIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  deleteBidDocument,
  getBidDocumentUrl,
  updateBidDocumentCategory,
  uploadBidDocument,
} from '@/lib/supabase/storage'
import type { BidDocument } from '@/lib/supabase/types'
import { useUserRole } from '@/contexts/userRole'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
const CATEGORIES = ['Plans', 'Specs', 'Proposals', 'Other'] as const
type Category = (typeof CATEGORIES)[number]

type SortOption = 'date' | 'name' | 'size'

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

function sortDocuments(docs: BidDocument[], sort: SortOption): BidDocument[] {
  const sorted = [...docs]
  switch (sort) {
    case 'date':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      break
    case 'name':
      sorted.sort((a, b) => a.file_name.localeCompare(b.file_name))
      break
    case 'size':
      sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))
      break
  }
  return sorted
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
  const [uploadCategory, setUploadCategory] = useState<Category>('Other')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

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
        await uploadBidDocument(supabase, bidId, file, profile.id, uploadCategory)
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

  async function handleCategoryChange(doc: BidDocument, newCategory: string) {
    try {
      const supabase = createClient()
      await updateBidDocumentCategory(supabase, doc.id, newCategory)
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, category: newCategory } : d))
      )
      toast.success(`Moved to ${newCategory}.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move document'
      toast.error(msg)
    }
  }

  function canDelete(doc: BidDocument): boolean {
    if (!profile) return false
    return isAdmin || doc.uploaded_by === profile.id
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Filter + sort
  const filteredDocs = useMemo(() => {
    let docs = documents
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      docs = docs.filter((d) => d.file_name.toLowerCase().includes(q))
    }
    return sortDocuments(docs, sortBy)
  }, [documents, searchQuery, sortBy])

  // Group by category
  const groupedDocs = useMemo(() => {
    const groups: Record<string, BidDocument[]> = {}
    for (const cat of CATEGORIES) groups[cat] = []
    for (const doc of filteredDocs) {
      const cat = CATEGORIES.includes(doc.category as Category) ? doc.category : 'Other'
      groups[cat].push(doc)
    }
    return groups
  }, [filteredDocs])

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="space-y-3">
      {/* Drop zone — drag only, no click */}
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          dragCounterRef.current++
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          dragCounterRef.current--
          if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0
            setDragging(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragCounterRef.current = 0
          setDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '16px',
          textAlign: 'center',
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
          {uploading ? 'Uploading…' : 'Drag files here to upload'}
        </p>
        <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--text3)' }}>
          PDF, Word, Excel, images
        </p>

        {/* Category selector + Browse button */}
        <div className="flex items-center justify-center gap-2">
          <Select
            value={uploadCategory}
            onValueChange={(v) => setUploadCategory(v as Category)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs cursor-pointer"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Browse Files
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Search + Sort bar */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
              style={{ color: 'var(--text3)' }}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date Uploaded</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="size">File Size</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
          Loading documents…
        </p>
      ) : documents.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
          No documents yet.
        </p>
      ) : filteredDocs.length === 0 && isSearching ? (
        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
          No documents match &quot;{searchQuery}&quot;.
        </p>
      ) : (
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const docs = groupedDocs[cat]
            if (docs.length === 0 && isSearching) return null
            const isCollapsed = collapsedCategories.has(cat)

            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
                  onClick={() => toggleCategory(cat)}
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="size-3.5 shrink-0" style={{ color: 'var(--text3)' }} />
                  ) : (
                    <ChevronDownIcon className="size-3.5 shrink-0" style={{ color: 'var(--text3)' }} />
                  )}
                  <FolderIcon className="size-3.5 shrink-0" style={{ color: 'var(--text3)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
                    {cat}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>
                    ({docs.length})
                  </span>
                </button>

                {/* Files in category */}
                {!isCollapsed && (
                  <ul className="ml-5 space-y-1 mt-0.5">
                    {docs.length === 0 ? (
                      <li className="px-3 py-1.5">
                        <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
                          No files
                        </p>
                      </li>
                    ) : (
                      docs.map((doc) => (
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
                            className="shrink-0 size-4"
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
                              {isSearching && (
                                <span className="ml-1.5 text-muted-foreground/70">
                                  · {doc.category}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Move to category */}
                          <Select
                            value={doc.category ?? 'Other'}
                            onValueChange={(v) => { if (v) void handleCategoryChange(doc, v) }}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
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
                              className="cursor-pointer"
                              onClick={() => setPendingDelete(doc)}
                              title="Delete"
                              aria-label={`Delete ${doc.file_name}`}
                            >
                              <Trash2Icon className="size-4 text-destructive" />
                            </Button>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
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
