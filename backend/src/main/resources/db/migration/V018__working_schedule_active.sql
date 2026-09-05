-- The schedule list is specified with a Status column (Active / Inactive), but the table
-- had no such field, so every row rendered as inactive.
ALTER TABLE working_schedule ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
