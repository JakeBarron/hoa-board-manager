-- CRA Projects: execution-tracker columns, integer-cents money, authorship fix,
-- and RLS that lets the CRA chair (position name = 'cra') manage CRA data.
-- PRECONDITION: cra_projects / cra_quotes / cra_updates / cra_documents are EMPTY.

-- ─── Money: dollars(numeric) → integer cents ────────────────────────────────
alter table cra_projects alter column estimated_cost type integer using (estimated_cost * 100)::integer;
alter table cra_quotes    alter column amount         type integer using (amount * 100)::integer;

-- ─── cra_projects: new execution-tracker columns ────────────────────────────
alter table cra_projects add column actual_cost    integer;
alter table cra_projects add column target_date     date;
alter table cra_projects add column fiscal_year_id  uuid references fiscal_years(id);
alter table cra_projects add column category        text;
alter table cra_projects add column priority        text check (priority in ('high','medium','low'));

-- ─── cra_quotes: contact card + selected-vendor flag ────────────────────────
alter table cra_quotes add column contact_name  text;
alter table cra_quotes add column contact_phone text;
alter table cra_quotes add column contact_email text;
alter table cra_quotes add column is_selected   boolean not null default false;

-- ─── cra_updates: authorship as a positions FK (old check excluded 'cra') ────
alter table cra_updates drop column created_by_position;   -- drops its check constraint too
alter table cra_updates add  column created_by uuid not null references positions(id);

-- ─── Editor helper: president/officer OR the CRA chair position ──────────────
create or replace function is_cra_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
      and (role in ('president','officer') or name = 'cra')
  );
$$;

-- ─── Replace officer-only write policies; add the missing delete/update ones ─
drop policy if exists "cra_projects_insert" on cra_projects;
drop policy if exists "cra_projects_update" on cra_projects;
drop policy if exists "cra_quotes_insert"   on cra_quotes;
drop policy if exists "cra_updates_insert"  on cra_updates;
drop policy if exists "cra_docs_insert"     on cra_documents;

create policy "cra_projects_insert" on cra_projects for insert to authenticated with check (is_cra_editor());
create policy "cra_projects_update" on cra_projects for update to authenticated using (is_cra_editor());
create policy "cra_projects_delete" on cra_projects for delete to authenticated using (is_cra_editor());

create policy "cra_quotes_insert" on cra_quotes for insert to authenticated with check (is_cra_editor());
create policy "cra_quotes_update" on cra_quotes for update to authenticated using (is_cra_editor());
create policy "cra_quotes_delete" on cra_quotes for delete to authenticated using (is_cra_editor());

create policy "cra_updates_insert" on cra_updates for insert to authenticated with check (is_cra_editor());

create policy "cra_docs_insert" on cra_documents for insert to authenticated with check (is_cra_editor());
create policy "cra_docs_delete" on cra_documents for delete to authenticated using (is_cra_editor());
