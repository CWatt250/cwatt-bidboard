-- 025_add_todo_dismissed.sql
-- Separates "hidden from the to-do list" from "deleted from the DB".
-- Completed tasks are dismissed (this column set) instead of deleted, so the
-- Weekly Recap can still show them for the week they were completed.
ALTER TABLE workspace_todos
  ADD COLUMN IF NOT EXISTS dismissed_from_list_at timestamptz;
