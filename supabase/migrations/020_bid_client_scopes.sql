-- Add a per-client scope selection so each client on a bid can be assigned a
-- subset of the bid's scopes. The per-client total is derived from
-- bid_line_items.price summed across these scopes (no per-client pricing column).
ALTER TABLE bid_clients ADD COLUMN scopes text[] NOT NULL DEFAULT '{}';

-- Backfill: each existing bid_client row gets all scopes currently on the parent bid.
-- User can deselect any that don't apply per-client.
UPDATE bid_clients bc
SET scopes = COALESCE(
  ARRAY(
    SELECT DISTINCT scope::text
    FROM bid_line_items
    WHERE bid_id = bc.bid_id
  ),
  '{}'::text[]
);
