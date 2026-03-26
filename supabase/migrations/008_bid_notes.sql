CREATE TABLE bid_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE bid_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based notes select"
  ON bid_notes FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_notes.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Authenticated users can insert notes"
  ON bid_notes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
