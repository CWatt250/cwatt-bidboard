-- Add category column to bid_documents for folder organization
ALTER TABLE bid_documents
  ADD COLUMN category text NOT NULL DEFAULT 'Other';
