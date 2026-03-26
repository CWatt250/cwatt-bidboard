-- Rename branch enum values to real branch codes
ALTER TYPE branch RENAME TO branch_old;

CREATE TYPE branch AS ENUM ('PSC', 'SEA', 'POR', 'PHX', 'SLC');

-- Update profiles table
ALTER TABLE profiles
  ALTER COLUMN branch TYPE branch
  USING branch::text::branch;

-- Update bids table
ALTER TABLE bids
  ALTER COLUMN branch TYPE branch
  USING branch::text::branch;

DROP TYPE branch_old;
