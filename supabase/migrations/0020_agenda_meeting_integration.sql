-- Agenda → Meetings Integration
--
-- Re-keys pre_meeting_updates from a bare meeting_date to the meeting row itself,
-- so that the single "NEXT" meeting everyone targets owns its updates and a
-- reschedule never orphans them. Also enforces "one queued meeting per date" at
-- the DB layer to prevent concurrent-adjourn auto-schedule duplicates.
--
-- Apply by hand in the Supabase SQL editor (no CLI integration) on BOTH the e2e
-- and prod projects, in order.

-- ─── pre_meeting_updates.meeting_id ──────────────────────────────────────────

ALTER TABLE pre_meeting_updates
  ADD COLUMN meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE;

-- Backfill from existing meetings by matching the legacy meeting_date. A date can
-- map to more than one meeting once a prior meeting on that date was adjourned, so
-- tie-break to the non-adjourned meeting, then the most recently created one.
UPDATE pre_meeting_updates u
SET meeting_id = m.id
FROM (
  SELECT DISTINCT ON (meeting_date) id, meeting_date
  FROM meetings
  ORDER BY meeting_date,
           (status = 'adjourned') ASC,  -- non-adjourned first
           created_at DESC
) m
WHERE m.meeting_date = u.meeting_date;

-- meeting_date is no longer written by application code; keep it nullable for the
-- legacy rows that did not match any meeting (they stay historical / invisible to
-- the new meeting_id-keyed readers).
ALTER TABLE pre_meeting_updates ALTER COLUMN meeting_date DROP NOT NULL;

-- Swap the uniqueness from (position_id, meeting_date) to (position_id, meeting_id).
ALTER TABLE pre_meeting_updates
  DROP CONSTRAINT pre_meeting_updates_position_id_meeting_date_key;

ALTER TABLE pre_meeting_updates
  ADD CONSTRAINT pre_meeting_updates_position_id_meeting_id_key
  UNIQUE (position_id, meeting_id);

-- ─── one queued meeting per date ─────────────────────────────────────────────
-- Makes the "append-only queue" + auto-schedule-on-adjourn safe against races:
-- only one pending/in_progress meeting may exist for a given date. Adjourned
-- meetings are excluded so a date can be reused historically.
CREATE UNIQUE INDEX meetings_one_pending_per_date
  ON meetings (meeting_date)
  WHERE status IN ('pending', 'in_progress');
