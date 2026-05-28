-- Introduce officer role for VP and Secretary
-- Officers can read and edit any board section; members can only edit their own.

-- ─── Update role constraint ──────────────────────────────────────────────────
alter table positions drop constraint positions_role_check;
alter table positions add constraint positions_role_check
  check (role in ('president','officer','member'));

-- Assign officer role to VP and secretary
update positions set role = 'officer' where name in ('vp','secretary');

-- ─── Update helper function ──────────────────────────────────────────────────
-- is_president() remains for admin-only gates (manage positions page).
-- Add is_officer_or_above() for section-edit gates.
create or replace function is_officer_or_above()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
    and role in ('president','officer')
  );
$$;

-- ─── Update RLS policies that restrict writes to own section ─────────────────
-- meeting_minutes: officers and above can insert/update any row
drop policy "minutes_insert" on meeting_minutes;
drop policy "minutes_update" on meeting_minutes;

create policy "minutes_insert" on meeting_minutes for insert to authenticated
  with check (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

create policy "minutes_update" on meeting_minutes for update to authenticated
  using (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

-- todos
drop policy "todos_insert" on todos;
drop policy "todos_update" on todos;
drop policy "todos_delete" on todos;

create policy "todos_insert" on todos for insert to authenticated
  with check (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

create policy "todos_update" on todos for update to authenticated
  using (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

create policy "todos_delete" on todos for delete to authenticated
  using (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

-- pre_meeting_updates
drop policy "pre_meeting_insert" on pre_meeting_updates;
drop policy "pre_meeting_update" on pre_meeting_updates;

create policy "pre_meeting_insert" on pre_meeting_updates for insert to authenticated
  with check (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

create policy "pre_meeting_update" on pre_meeting_updates for update to authenticated
  using (
    is_officer_or_above()
    or (select id from current_position()) = position_id
  );

-- CRA: restrict inserts/updates to officer-or-above (members are read-only)
drop policy "cra_projects_insert" on cra_projects;
drop policy "cra_projects_update" on cra_projects;
drop policy "cra_quotes_insert"   on cra_quotes;
drop policy "cra_updates_insert"  on cra_updates;
drop policy "cra_docs_insert"     on cra_documents;

create policy "cra_projects_insert" on cra_projects for insert to authenticated
  with check (is_officer_or_above());
create policy "cra_projects_update" on cra_projects for update to authenticated
  using (is_officer_or_above());
create policy "cra_quotes_insert"   on cra_quotes  for insert to authenticated
  with check (is_officer_or_above());
create policy "cra_updates_insert"  on cra_updates for insert to authenticated
  with check (is_officer_or_above());
create policy "cra_docs_insert"     on cra_documents for insert to authenticated
  with check (is_officer_or_above());
