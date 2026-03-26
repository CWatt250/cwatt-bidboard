CREATE TABLE bid_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE bid_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based activity select"
  ON bid_activity FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_activity.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Authenticated users can insert activity"
  ON bid_activity FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
