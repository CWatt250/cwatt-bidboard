-- Add role enum
CREATE TYPE user_role AS ENUM ('estimator', 'branch_manager', 'admin');

-- Update profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'estimator',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Drop old single branch column from profiles
-- We'll use a junction table for multi-branch support
ALTER TABLE profiles DROP COLUMN IF EXISTS branch;

-- Create user_branches junction table
-- Supports Branch Managers assigned to multiple branches
CREATE TABLE user_branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  branch branch NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, branch)
);

-- Enable RLS
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all user_branches"
  ON user_branches FOR SELECT USING (true);

CREATE POLICY "Admins can manage user_branches"
  ON user_branches FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Workspace todos table
CREATE TABLE workspace_todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE workspace_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own todos"
  ON workspace_todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todos"
  ON workspace_todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON workspace_todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON workspace_todos FOR DELETE
  USING (auth.uid() = user_id);
