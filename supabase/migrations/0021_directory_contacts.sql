-- Board Directory + Contacts
-- Adds: phone numbers on positions, three new committee-chair positions,
-- a collaborative contacts table (open to all authenticated users), and the
-- Homeside management-company settings rows surfaced on the dashboard.
-- Run manually in the Supabase SQL editor (e2e then prod). Idempotent.

-- ─── (a) Phone on positions ───────────────────────────────────────────────────
alter table positions add column if not exists phone text;

-- ─── (b) New committee-chair positions ────────────────────────────────────────
-- children_social: Children's Social (often vacant; Adult Social = existing 'social')
-- newsletter, social_media: communications chairs
alter table positions drop constraint positions_name_check;
alter table positions add constraint positions_name_check
  check (name in (
    'president','vp','secretary','treasurer',
    'pool','membership','tennis','social','grounds',
    'web','architecture','welcoming','clubhouse','cra',
    'children_social','newsletter','social_media'
  ));

-- Position rows only — no Supabase Auth accounts are created until a real person
-- is assigned to the role.
insert into positions (name, email, role, is_voting_member) values
  ('children_social', 'children_social@yourhoa.com', 'chair', false),
  ('newsletter',      'newsletter@yourhoa.com',      'chair', false),
  ('social_media',    'social_media@yourhoa.com',     'chair', false)
on conflict (name) do nothing;

-- ─── (c) Contacts table (committee people without logins) ──────────────────────
-- Intentionally collaborative: ANY authenticated user can read AND write so each
-- section can maintain its own contacts (Pool adds pool contacts, etc.).
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  title       text,
  email       text,
  phone       text,
  category    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table contacts enable row level security;

-- Separate per-verb policies (not "for all") to make the open-edit decision explicit.
create policy "contacts_select" on contacts for select to authenticated using (true);
create policy "contacts_insert" on contacts for insert to authenticated with check (true);
create policy "contacts_update" on contacts for update to authenticated using (true) with check (true);
create policy "contacts_delete" on contacts for delete to authenticated using (true);

grant all on contacts to anon, authenticated, service_role;

-- ─── (d) Homeside management-company settings ─────────────────────────────────
insert into settings (key, value, description) values
  ('homeside_contact_name', '', 'Homeside management company contact name'),
  ('homeside_phone',        '', 'Homeside management phone number'),
  ('homeside_email',        '', 'Homeside management email address'),
  ('homeside_portal_url',   '', 'Homeside resident/owner portal URL')
on conflict (key) do nothing;
