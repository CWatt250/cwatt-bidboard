-- Bid documents: metadata table + private storage bucket + RLS policies

CREATE TABLE bid_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id uuid NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX bid_documents_bid_id_idx ON bid_documents(bid_id);

ALTER TABLE bid_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bid documents"
ON bid_documents FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert bid documents"
ON bid_documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own documents"
ON bid_documents FOR DELETE USING (uploaded_by = auth.uid());

-- Private storage bucket for bid documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('bid-documents', 'bid-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies (scoped to this bucket only)
CREATE POLICY "Authenticated users can read bid-documents objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'bid-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload bid-documents objects"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bid-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update bid-documents objects"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bid-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Uploader can delete bid-documents objects"
ON storage.objects FOR DELETE
USING (bucket_id = 'bid-documents' AND auth.uid() = owner);
