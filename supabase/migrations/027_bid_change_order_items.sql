-- Create the new items table for per-scope value breakdown on change orders
CREATE TABLE bid_change_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid NOT NULL REFERENCES bid_change_orders(id) ON DELETE CASCADE,
  scope text NOT NULL,
  value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX bid_change_order_items_co_id_idx ON bid_change_order_items(change_order_id);

-- RLS
ALTER TABLE bid_change_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CO items"
  ON bid_change_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bid_change_orders
    WHERE bid_change_orders.id = bid_change_order_items.change_order_id
  ));

CREATE POLICY "Users can insert CO items"
  ON bid_change_order_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update CO items"
  ON bid_change_order_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete CO items"
  ON bid_change_order_items FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Migrate any existing CO values into a single "General" item
INSERT INTO bid_change_order_items (change_order_id, scope, value)
SELECT id, 'General', value
FROM bid_change_orders
WHERE value IS NOT NULL AND value != 0;

-- Drop the columns no longer needed on the parent table
ALTER TABLE bid_change_orders DROP COLUMN IF EXISTS scope;
ALTER TABLE bid_change_orders DROP COLUMN IF EXISTS value;
