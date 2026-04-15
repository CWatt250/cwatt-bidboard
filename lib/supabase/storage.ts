import type { SupabaseClient } from '@supabase/supabase-js'
import type { BidDocument } from './types'

const BUCKET = 'bid-documents'

export async function uploadBidDocument(
  supabase: SupabaseClient,
  bidId: string,
  file: File,
  uploadedBy: string
): Promise<BidDocument> {
  const filePath = `${bidId}/${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type || undefined })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('bid_documents')
    .insert({
      bid_id: bidId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || null,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath])
    throw insertError
  }

  return data as BidDocument
}

export async function getBidDocumentUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60)

  if (error || !data) throw error ?? new Error('Failed to create signed URL')
  return data.signedUrl
}

export async function deleteBidDocument(
  supabase: SupabaseClient,
  doc: BidDocument
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([doc.file_path])
  if (storageError) throw storageError

  const { error: dbError } = await supabase
    .from('bid_documents')
    .delete()
    .eq('id', doc.id)
  if (dbError) throw dbError
}
