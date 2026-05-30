-- Allow any officer-level user or above to record that a reminder was sent.
-- The existing meetings_update policy only permits the scheduler or president
-- to modify meeting rows; this targeted policy unblocks reminder tracking
-- for VP and Secretary without opening other meeting fields.
--
-- Postgres evaluates multiple permissive UPDATE policies with OR logic, so a
-- VP or Secretary will pass this check even when they don't satisfy the
-- stricter meetings_update policy.
--
-- is_officer_or_above() is defined in 0003_add_officer_role.sql and returns
-- true for roles 'officer' and 'president'.

create policy "officers can record reminder sent"
  on meetings
  for update
  to authenticated
  using (is_officer_or_above())
  with check (is_officer_or_above());
