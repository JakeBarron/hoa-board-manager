-- HOA Board Management — Initial Schema
-- Run this in the Supabase SQL editor or via: supabase db push

-- ─── Enable UUID extension ─────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Board Positions ────────────────────────────────────────────────────────
-- Fixed set of 7 positions. Each maps to a Supabase Auth user by email.
-- The president role gets extra permissions enforced via RLS.
create table positions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (name in ('president','vp','treasurer','pool','membership','tennis','social')),
  email      text not null unique,
  role       text not null default 'member' check (role in ('president','member')),
  created_at timestamptz not null default now()
);

-- ─── Architecture Requests ──────────────────────────────────────────────────
create table architecture_requests (
  id           uuid primary key default gen_random_uuid(),
  address      text not null,
  description  text not null,
  status       text not null default 'pending' check (status in ('pending','approved','denied')),
  vote_outcome text check (vote_outcome in ('unanimous','majority','denied')),
  vote_ratio   text,   -- e.g. "5-2", "unanimous"
  notes        text,
  created_by   uuid not null references positions(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Documents attached to an architecture request (scanned forms, plans, samples)
create table architecture_documents (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references architecture_requests(id) on delete cascade,
  storage_path text not null,   -- path in Supabase Storage bucket "architecture-docs"
  file_name    text not null,
  doc_type     text not null default 'other' check (doc_type in ('form','plan','sample','other')),
  created_at   timestamptz not null default now()
);

-- ─── CRA (Capital Reserves Analysis) Projects ───────────────────────────────
create table cra_projects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  status         text not null default 'proposed' check (status in ('proposed','approved','in_progress','complete','on_hold')),
  estimated_cost numeric(12,2),
  created_by     uuid not null references positions(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table cra_quotes (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references cra_projects(id) on delete cascade,
  vendor_name  text not null,
  amount       numeric(12,2) not null,
  notes        text,
  document_url text,   -- link to quote document (Google Doc URL or storage path)
  created_at   timestamptz not null default now()
);

create table cra_updates (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references cra_projects(id) on delete cascade,
  content              text not null,
  created_by_position  text not null check (created_by_position in ('president','vp','treasurer','pool','membership','tennis','social')),
  created_at           timestamptz not null default now()
);

create table cra_documents (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references cra_projects(id) on delete cascade,
  name       text not null,
  url        text not null,
  url_type   text not null default 'google_doc' check (url_type in ('google_doc','storage_file')),
  created_at timestamptz not null default now()
);

-- ─── Per-Position Board Content ─────────────────────────────────────────────
create table meeting_minutes (
  id             uuid primary key default gen_random_uuid(),
  position_id    uuid not null references positions(id) on delete cascade,
  meeting_date   date not null,
  content        text,            -- inline text content
  google_doc_url text,            -- OR a Google Doc link
  created_at     timestamptz not null default now(),
  -- Either content or a Google Doc URL must be present
  constraint content_or_doc_url check (content is not null or google_doc_url is not null)
);

create table todos (
  id          uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions(id) on delete cascade,
  title       text not null,
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table pre_meeting_updates (
  id           uuid primary key default gen_random_uuid(),
  position_id  uuid not null references positions(id) on delete cascade,
  meeting_date date not null,
  content      text not null,
  submitted_at timestamptz not null default now(),
  -- One update per position per meeting date
  unique (position_id, meeting_date)
);

-- ─── Auto-update updated_at timestamps ─────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger architecture_requests_updated_at
  before update on architecture_requests
  for each row execute function set_updated_at();

create trigger cra_projects_updated_at
  before update on cra_projects
  for each row execute function set_updated_at();

create trigger todos_updated_at
  before update on todos
  for each row execute function set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table positions               enable row level security;
alter table architecture_requests   enable row level security;
alter table architecture_documents  enable row level security;
alter table cra_projects            enable row level security;
alter table cra_quotes              enable row level security;
alter table cra_updates             enable row level security;
alter table cra_documents           enable row level security;
alter table meeting_minutes         enable row level security;
alter table todos                   enable row level security;
alter table pre_meeting_updates     enable row level security;

-- Helper: get the positions row for the currently authenticated user
create or replace function current_position()
returns positions language sql security definer as $$
  select * from positions where email = auth.email() limit 1;
$$;

-- Helper: true if the current user holds the president role
create or replace function is_president()
returns boolean language sql security definer as $$
  select exists (select 1 from positions where email = auth.email() and role = 'president');
$$;

-- Positions: anyone authenticated can read; only president can update emails
create policy "positions_select" on positions for select to authenticated using (true);
create policy "positions_update" on positions for update to authenticated using (is_president());

-- Architecture requests: all authenticated users can read & insert; president can update votes
create policy "arch_requests_select" on architecture_requests for select to authenticated using (true);
create policy "arch_requests_insert" on architecture_requests for insert to authenticated with check (true);
create policy "arch_requests_update" on architecture_requests for update to authenticated using (is_president());

-- Architecture documents: all authenticated can read & insert; public read via storage bucket
create policy "arch_docs_select" on architecture_documents for select to authenticated using (true);
create policy "arch_docs_insert" on architecture_documents for insert to authenticated with check (true);

-- Public read for architecture request details (for deep-link sharing)
-- This is handled at the storage bucket level for files.
-- The architecture_requests & architecture_documents tables allow anon read:
create policy "arch_requests_public_select" on architecture_requests for select to anon using (true);
create policy "arch_docs_public_select" on architecture_documents for select to anon using (true);

-- CRA: all authenticated users can read; any board member can insert/update
create policy "cra_projects_select" on cra_projects for select to authenticated using (true);
create policy "cra_projects_insert" on cra_projects for insert to authenticated with check (true);
create policy "cra_projects_update" on cra_projects for update to authenticated using (true);

create policy "cra_quotes_select"   on cra_quotes  for select to authenticated using (true);
create policy "cra_quotes_insert"   on cra_quotes  for insert to authenticated with check (true);
create policy "cra_updates_select"  on cra_updates for select to authenticated using (true);
create policy "cra_updates_insert"  on cra_updates for insert to authenticated with check (true);
create policy "cra_docs_select"     on cra_documents for select to authenticated using (true);
create policy "cra_docs_insert"     on cra_documents for insert to authenticated with check (true);

-- Per-position content: each position manages their own rows
create policy "minutes_select" on meeting_minutes for select to authenticated using (true);
create policy "minutes_insert" on meeting_minutes for insert to authenticated
  with check ((select id from current_position()) = position_id);
create policy "minutes_update" on meeting_minutes for update to authenticated
  using ((select id from current_position()) = position_id);

create policy "todos_select" on todos for select to authenticated using (true);
create policy "todos_insert" on todos for insert to authenticated
  with check ((select id from current_position()) = position_id);
create policy "todos_update" on todos for update to authenticated
  using ((select id from current_position()) = position_id);
create policy "todos_delete" on todos for delete to authenticated
  using ((select id from current_position()) = position_id);

create policy "pre_meeting_select" on pre_meeting_updates for select to authenticated using (true);
create policy "pre_meeting_insert" on pre_meeting_updates for insert to authenticated
  with check ((select id from current_position()) = position_id);
create policy "pre_meeting_update" on pre_meeting_updates for update to authenticated
  using ((select id from current_position()) = position_id);
