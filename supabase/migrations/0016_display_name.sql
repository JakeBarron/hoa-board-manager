-- Add optional display_name to positions for recording the person's real name.
-- Null means no name set; app falls back to the position title.

ALTER TABLE positions ADD COLUMN display_name TEXT;
