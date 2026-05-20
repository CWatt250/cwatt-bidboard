-- Add scope column to bid_change_orders for optional scope tagging
ALTER TABLE bid_change_orders
ADD COLUMN IF NOT EXISTS scope text;
