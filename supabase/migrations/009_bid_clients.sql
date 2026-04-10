-- Create bid_clients junction table for multi-client support
CREATE TABLE bid_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(bid_id, client_name)
);

-- Enable RLS
ALTER TABLE bid_clients ENABLE ROW LEVEL SECURITY;

-- Migrate existing client data from bid_line_items
INSERT INTO bid_clients (bid_id, client_name)
SELECT DISTINCT bid_id, client
FROM bid_line_items
WHERE client IS NOT NULL AND client != '';

-- RLS Policies (inherit parent bid access via helper functions)
CREATE POLICY "Role-based bid_clients select"
  ON bid_clients FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_clients.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Role-based bid_clients insert"
  ON bid_clients FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_clients.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Role-based bid_clients delete"
  ON bid_clients FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_clients.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );
