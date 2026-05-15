-- Add completed_at timestamp to workspace_todos for task completion tracking
ALTER TABLE workspace_todos
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Set completed_at for existing completed tasks (backfill)
UPDATE workspace_todos
SET completed_at = updated_at
WHERE is_completed = true AND completed_at IS NULL;
