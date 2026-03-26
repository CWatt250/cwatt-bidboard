-- Create bid_line_items table
CREATE TABLE bid_line_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  client text NOT NULL,
  scope scope NOT NULL,
  price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE bid_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all bid line items"
  ON bid_line_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert bid line items"
  ON bid_line_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update bid line items"
  ON bid_line_items FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete bid line items"
  ON bid_line_items FOR DELETE USING (auth.role() = 'authenticated');

-- Remove old fields from bids table that are now in line items
ALTER TABLE bids DROP COLUMN IF EXISTS client;
ALTER TABLE bids DROP COLUMN IF EXISTS scope;
ALTER TABLE bids DROP COLUMN IF EXISTS bid_price;

-- Add Awarded and Lost to bid_status enum
ALTER TYPE bid_status ADD VALUE 'Awarded';
ALTER TYPE bid_status ADD VALUE 'Lost';
