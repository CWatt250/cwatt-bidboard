-- Add awarded_at timestamp so we can query when a scope was awarded.
-- Nullable: existing is_awarded=true rows stay NULL (they were awarded too long ago
-- to matter for week-scoped Recap metrics; they remain visible in Awarded views as-is).
ALTER TABLE bid_line_items
  ADD COLUMN awarded_at timestamptz;

-- Add 'Verbal' to the bid_status enum.
-- Conceptually sits between 'Sent' and 'Awarded' — bid was sent and verbal commitment received,
-- but not yet officially awarded.
ALTER TYPE bid_status ADD VALUE 'Verbal' AFTER 'Sent';
