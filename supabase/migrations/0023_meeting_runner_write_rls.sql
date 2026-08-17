-- ─────────────────────────────────────────────────────────────────────────────
-- 0023: let a non-president officer actually run a meeting
--
-- The meeting runner is single-operator by design: one officer (president OR
-- secretary) records the motion, the second, and the whole board's votes on
-- behalf of everyone present. The 0005 policies only ever permitted the
-- president to do that, so a secretary-run meeting failed in three ways:
--
--   1. motion_votes_insert was gated on `position_id = current_position().id`.
--      The runner bulk-inserts one row per voting position, so every row but the
--      operator's own violated WITH CHECK and the whole statement aborted with
--      42501. Observable as "Failed to record vote" after the motion row had
--      already been written — and each retry left another orphaned motion.
--
--   2. motions_update was gated on `proposed_by = current_position().id`. A
--      failing USING clause matches zero rows and returns NO error, so
--      secondMotion() and closeMotion() silently no-op'd whenever the operator
--      named someone else as proposer. Motions were left stuck in 'proposed'
--      with null seconded_by, null quorum_met and null closed_at, while the
--      minutes text (computed client-side) claimed the motion had passed.
--
--   3. meetings_update was gated on `called_by = current_position().id`, so an
--      officer who did not personally schedule the meeting could not write
--      minutes_content, status, adjourned_at or present_positions — and again
--      silently, matching zero rows and returning no error. saveMeetingMinutes
--      therefore reported success while persisting nothing.
--
-- Measured against e2e on 2026-08-16, acting as secretary@yourhoa.com:
--
--   | attempt                              | rows | error |
--   |--------------------------------------|------|-------|
--   | update meetings (13 adjourned)       |    0 | none  |
--   | update motions (6 rows)              |    0 | none  |
--   | insert motion_votes for another seat |    — | 42501 |
--
-- The same probes as the president matched 13 and 6 rows, which is why the
-- runner has always appeared to work: only the president has ever driven it.
--
-- Votes stay immutable: there is still no UPDATE and no DELETE policy on
-- motion_votes. `recorded_by` remains the audit trail for who captured each
-- vote, which is what distinguishes an operator-recorded vote from a self-cast
-- one now that officers may record on another position's behalf.
--
-- is_officer_or_above() already includes the president, so the explicit
-- is_president() term is redundant and is dropped.
--
-- NOTE ON 0010: `0010_reminder_rls.sql` added an officers-can-update policy to
-- `meetings` for reminder_sent_at, but it is NOT present in e2e — it was never
-- applied there despite being recorded as run. Its comment also claims it does
-- not open other meeting fields, which is wrong: it names no columns, so it
-- grants full-row update. This migration drops it if present and replaces it
-- with an equivalently-scoped policy that is named and documented honestly, so
-- every environment converges on the same state regardless of whether 0010 ran.
-- ─────────────────────────────────────────────────────────────────────────────

-- Motion votes: own vote, or any vote when recorded by an officer running the meeting.
drop policy if exists "motion_votes_insert" on motion_votes;
create policy "motion_votes_insert" on motion_votes for insert to authenticated
  with check (
    position_id = (select id from current_position())
    or is_officer_or_above()
  );

-- Motions: the proposer or any officer may second, close, or otherwise update.
drop policy if exists "motions_update" on motions;
create policy "motions_update" on motions for update to authenticated
  using (
    proposed_by = (select id from current_position())
    or is_officer_or_above()
  )
  with check (
    proposed_by = (select id from current_position())
    or is_officer_or_above()
  );

-- Meetings: the scheduler, or any officer running the meeting.
--
-- This is deliberately full-row, not column-scoped: an officer operating the
-- runner writes minutes_content, status, started_at, adjourned_at and
-- present_positions over the course of one meeting. Postgres has no
-- column-level RLS, so narrowing it would mean splitting the write path into
-- SECURITY DEFINER functions — more machinery than a five-officer board needs,
-- and the officer role already means "may edit any section" everywhere else in
-- this app.
drop policy if exists "officers can record reminder sent" on meetings;
drop policy if exists "meetings_update" on meetings;
create policy "meetings_update" on meetings for update to authenticated
  using (
    called_by = (select id from current_position())
    or is_officer_or_above()
  )
  with check (
    called_by = (select id from current_position())
    or is_officer_or_above()
  );
