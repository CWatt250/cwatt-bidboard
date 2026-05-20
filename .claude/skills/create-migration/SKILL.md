---
name: create-migration
description: Scaffolds the next-numbered Supabase migration file for BidWatt. Use when the user wants to create a new migration, add a new column or table, or evolve the database schema. Reminds the user that migrations must be applied by hand in the Supabase SQL editor.
disable-model-invocation: true
---

# create-migration

Use this skill ONLY when the user explicitly asks to create a new migration. Do not invoke automatically.

## Procedure

1. List the files in `supabase/migrations/` and identify the highest-numbered migration (filenames are `NNN_description.sql`).

2. Ask the user for a short description of the migration (e.g. "add awarded_at to bid_line_items", "verbal status in bid_status enum"). Keep it short — this becomes part of the filename.

3. Compute the next number with three-digit zero-padding (e.g. if highest is 025, next is 026).

4. Convert the description to snake_case for the filename. Example: "add awarded_at column" becomes "add_awarded_at_column".

5. Create the file at `supabase/migrations/NNN_snake_case_description.sql` with a header:

   ```sql
   -- Migration NNN: human-readable description here
   -- Created: YYYY-MM-DD

   -- TODO: fill in migration SQL below
   ```

6. If CLAUDE.md tracks a migration list, add an entry following the existing format.

7. After writing, report:
   - The new migration filename
   - A reminder that the user must paste the SQL into the Supabase SQL editor manually — the MCP is read-only and Claude cannot apply migrations directly
   - A reminder that editing previously-applied migrations is forbidden (append-only rule)

## Invariants

- NEVER overwrite an existing migration file. If a migration with the computed number already exists, stop and ask the user what to do.
- NEVER apply migrations via any MCP write. `read_only=true` is on the Supabase MCP for a reason.
- Migration filenames are append-only: once committed, never renamed or renumbered.
