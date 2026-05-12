-- 018_scope_level_metadata.sql
-- Adds per-scope award status and per-scope estimator assignment to bid_line_items.
-- Backfills any line items belonging to bids already in 'Awarded' status so the
-- Awarded Jobs view continues to look the same after the feature ships.

ALTER TABLE bid_line_items
  ADD COLUMN is_awarded boolean NOT NULL DEFAULT false;

ALTER TABLE bid_line_items
  ADD COLUMN estimator_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill: every line item on a currently-Awarded bid is considered awarded.
UPDATE bid_line_items
SET is_awarded = true
WHERE bid_id IN (SELECT id FROM bids WHERE status = 'Awarded');
