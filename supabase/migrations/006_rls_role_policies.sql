-- Drop existing open policies on bids
DROP POLICY IF EXISTS "Users can view all bids" ON bids;
DROP POLICY IF EXISTS "Authenticated users can insert bids" ON bids;
DROP POLICY IF EXISTS "Authenticated users can update bids" ON bids;

-- Drop existing open policies on bid_line_items
DROP POLICY IF EXISTS "Users can view all bid line items" ON bid_line_items;
DROP POLICY IF EXISTS "Authenticated users can insert bid line items" ON bid_line_items;
DROP POLICY IF EXISTS "Authenticated users can update bid line items" ON bid_line_items;
DROP POLICY IF EXISTS "Authenticated users can delete bid line items" ON bid_line_items;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: check if user has access to a branch
CREATE OR REPLACE FUNCTION user_has_branch_access(bid_branch branch)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_branches
    WHERE user_id = auth.uid()
    AND branch = bid_branch
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- BIDS: Select policy
CREATE POLICY "Role-based bid select"
  ON bids FOR SELECT USING (
    get_user_role() = 'admin'
    OR (get_user_role() = 'branch_manager' AND user_has_branch_access(branch))
    OR (get_user_role() = 'estimator' AND user_has_branch_access(branch))
  );

-- BIDS: Insert policy (all authenticated users can create bids in their branch)
CREATE POLICY "Role-based bid insert"
  ON bids FOR INSERT WITH CHECK (
    get_user_role() = 'admin'
    OR user_has_branch_access(branch)
  );

-- BIDS: Update policy
CREATE POLICY "Role-based bid update"
  ON bids FOR UPDATE USING (
    get_user_role() = 'admin'
    OR (get_user_role() = 'branch_manager' AND user_has_branch_access(branch))
    OR (
      get_user_role() = 'estimator'
      AND user_has_branch_access(branch)
      AND (estimator_id = auth.uid() OR estimator_id IS NULL)
    )
  );

-- BIDS: Hard delete — admin only
CREATE POLICY "Admin only bid delete"
  ON bids FOR DELETE USING (get_user_role() = 'admin');

-- BID LINE ITEMS: inherit parent bid access
CREATE POLICY "Role-based line item select"
  ON bid_line_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Role-based line item insert"
  ON bid_line_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Role-based line item update"
  ON bid_line_items FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );

CREATE POLICY "Role-based line item delete"
  ON bid_line_items FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
      AND (
        get_user_role() = 'admin'
        OR user_has_branch_access(bids.branch)
      )
    )
  );
