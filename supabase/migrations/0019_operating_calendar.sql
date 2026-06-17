-- supabase/migrations/0019_operating_calendar.sql

create table responsibility_areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null,                 -- hex string, e.g. '#0f766e'
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table calendar_events (
  id                     uuid primary key default gen_random_uuid(),
  area_id                uuid not null references responsibility_areas(id) on delete restrict,
  title                  text not null unique,
  responsible_party      text,
  notes                  text,
  template_url           text,
  created_by_position_id uuid references positions(id),
  created_at             timestamptz not null default now(),
  updated_by_position_id uuid references positions(id),
  updated_at             timestamptz not null default now()
);

create table event_occurrences (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references calendar_events(id) on delete cascade,
  month         integer not null check (month between 1 and 12),
  day_of_month  integer check (day_of_month between 1 and 31),
  unique (event_id, month)
);

-- Enable RLS
alter table responsibility_areas enable row level security;
alter table calendar_events enable row level security;
alter table event_occurrences enable row level security;

-- Helper: true if the current user is president or officer (canEditAll)
create or replace function is_calendar_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
    and role in ('president', 'officer')
  );
$$;

-- responsibility_areas: all authenticated read; editors write
create policy "ra_read" on responsibility_areas for select to authenticated using (true);
create policy "ra_write" on responsibility_areas for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- calendar_events
create policy "ce_read" on calendar_events for select to authenticated using (true);
create policy "ce_write" on calendar_events for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- event_occurrences
create policy "eo_read" on event_occurrences for select to authenticated using (true);
create policy "eo_write" on event_occurrences for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- Grants (required for tables created after the initial "grant all" snapshot)
grant all on responsibility_areas to anon, authenticated, service_role;
grant all on calendar_events to anon, authenticated, service_role;
grant all on event_occurrences to anon, authenticated, service_role;

-- ── Seed: responsibility areas (hex colors) ──────────────────────────────
insert into responsibility_areas (name, color, sort_order) values
  ('Clubhouse',  '#b45309', 1),
  ('Membership', '#7c3aed', 2),
  ('Homeside',   '#0f766e', 3),
  ('Treasurer',  '#15803d', 4),
  ('Board',      '#1d4ed8', 5),
  ('Secretary',  '#0369a1', 6),
  ('Newsletter', '#c026d3', 7),
  ('Grounds',    '#4d7c0f', 8),
  ('Pool',       '#0891b2', 9),
  ('Social',     '#db2777', 10),
  ('Residents',  '#57534e', 11);

-- ── Seed: events ─────────────────────────────────────────────────────────
insert into calendar_events (area_id, title, responsible_party, notes) values
  -- Clubhouse (10 events)
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Monthly clubhouse cleaning', 'Clubhouse Chair', 'May task schedules ongoing cleanings'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Replace HVAC filter', 'Clubhouse Chair', null),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Termite bait station check', 'Clubhouse Chair', null),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Inventory supply closet & restock (summer rental prep)', 'Clubhouse Chair', 'paper goods, filters, lightbulbs'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'HVAC service check/service & change filter', 'Clubhouse Chair', null),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Pest control visit (interior/exterior/pool baths)', 'Clubhouse Chair', null),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Porch & furniture pressure-washing', 'Clubhouse Chair', 'coordinate w/ tennis court washing'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Distribute new board codes + update LOUD call list', 'Clubhouse Chair', 'add new members, remove old'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Schedule bi-monthly cleanings + weekly pool-bath cleanings', 'Clubhouse Chair', 'week before pool opens → Sept'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Fall deep clean (if needed)', 'Clubhouse Chair', null),
  -- Homeside (9 events)
  ((select id from responsibility_areas where name = 'Homeside'),
   'Legal retainer due', 'Homeside', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Annual dues letter prepared for mailing', 'Homeside', 'due by 3/1; Homeside mails to residents'),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Secretary of State filing due', 'Homeside', 'due 3/1'),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Dues letter & invoice received by residents', 'Homeside', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Insurance renewal', 'Homeside', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Annual backflow', 'Homeside', 'Dana → Morgan to schedule'),
  ((select id from responsibility_areas where name = 'Homeside'),
   'HOA taxes due', 'Homeside', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Fall assessment notices mailed (if planned)', 'Homeside', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Termite bond due', 'Homeside', null),
  -- Membership (2 events)
  ((select id from responsibility_areas where name = 'Membership'),
   'Prepare annual HOA dues letter for residents', 'Membership', 'due to Homeside by 2/1; prior yr avail for draft'),
  ((select id from responsibility_areas where name = 'Membership'),
   'Property check — violations reporting', 'Membership', 'monthly'),
  -- Treasurer (3 events)
  ((select id from responsibility_areas where name = 'Treasurer'),
   'Start planning next fiscal-year budget', 'Treasurer', null),
  ((select id from responsibility_areas where name = 'Treasurer'),
   'Draft budget ready to mail w/ annual meeting notice', 'Treasurer', 'else post to website for resident review'),
  ((select id from responsibility_areas where name = 'Treasurer'),
   'Transfer FYE surplus to Reserve before March close', 'Treasurer / Homeside', null),
  -- Board (2 events)
  ((select id from responsibility_areas where name = 'Board'),
   'Begin preparation for annual HOA meeting', 'Executive Board', null),
  ((select id from responsibility_areas where name = 'Board'),
   'Plan fall assessment notice (if needed)', 'Membership & Homeside', null),
  -- Secretary (1 event)
  ((select id from responsibility_areas where name = 'Secretary'),
   'Mail annual-meeting notice to residents', 'Secretary', 'slate + proxy ballot + draft-budget info; Homeside mails 10–30 days prior'),
  -- Newsletter (3 events)
  ((select id from responsibility_areas where name = 'Newsletter'),
   'Annual meeting coming up', 'Newsletter', null),
  ((select id from responsibility_areas where name = 'Newsletter'),
   'What happened in the meeting', 'Newsletter', null),
  ((select id from responsibility_areas where name = 'Newsletter'),
   'What''s coming', 'Newsletter', null),
  -- Grounds (3 events)
  ((select id from responsibility_areas where name = 'Grounds'),
   'Mulch (if needed)', 'Grounds', null),
  ((select id from responsibility_areas where name = 'Grounds'),
   'Spring flowers planned', 'Hartwell', null),
  ((select id from responsibility_areas where name = 'Grounds'),
   'Fall flowers planned', 'Hartwell', null),
  -- Pool (3 events)
  ((select id from responsibility_areas where name = 'Pool'),
   'Pool readiness — reprogram fobs after dues received', 'Pool Chair', 'add new SAYOR, remove old'),
  ((select id from responsibility_areas where name = 'Pool'),
   'Pool opens (swim team, then residents)', 'Pool Chair', null),
  ((select id from responsibility_areas where name = 'Pool'),
   'Pool closes for the year', 'Pool Chair', null),
  -- Social (3 events)
  ((select id from responsibility_areas where name = 'Social'),
   'End-of-year school / pool-opening party', 'Social (Kids)', 'last day of school'),
  ((select id from responsibility_areas where name = 'Social'),
   'Annual kids July 4th bike parade', 'Social (Kids)', null),
  ((select id from responsibility_areas where name = 'Social'),
   'Annual 5K run & Halloween events', 'Social', null),
  -- Residents (1 event)
  ((select id from responsibility_areas where name = 'Residents'),
   'Annual HOA dues due', 'Residents', 'late after Apr 30; mail or pay online to Homeside');

-- ── Seed: occurrences (one row per month per event) ──────────────────────
insert into event_occurrences (event_id, month, day_of_month) values
  -- Monthly clubhouse cleaning {1}
  ((select id from calendar_events where title = 'Monthly clubhouse cleaning'), 1, null),
  -- Replace HVAC filter {1,5,7}
  ((select id from calendar_events where title = 'Replace HVAC filter'), 1, null),
  ((select id from calendar_events where title = 'Replace HVAC filter'), 5, null),
  ((select id from calendar_events where title = 'Replace HVAC filter'), 7, null),
  -- Termite bait station check {1}
  ((select id from calendar_events where title = 'Termite bait station check'), 1, null),
  -- Inventory supply closet & restock (summer rental prep) {2}
  ((select id from calendar_events where title = 'Inventory supply closet & restock (summer rental prep)'), 2, null),
  -- HVAC service check/service & change filter {3,10}
  ((select id from calendar_events where title = 'HVAC service check/service & change filter'), 3, null),
  ((select id from calendar_events where title = 'HVAC service check/service & change filter'), 10, null),
  -- Pest control visit (interior/exterior/pool baths) {3,6,9,12}
  ((select id from calendar_events where title = 'Pest control visit (interior/exterior/pool baths)'), 3, null),
  ((select id from calendar_events where title = 'Pest control visit (interior/exterior/pool baths)'), 6, null),
  ((select id from calendar_events where title = 'Pest control visit (interior/exterior/pool baths)'), 9, null),
  ((select id from calendar_events where title = 'Pest control visit (interior/exterior/pool baths)'), 12, null),
  -- Porch & furniture pressure-washing {4}
  ((select id from calendar_events where title = 'Porch & furniture pressure-washing'), 4, null),
  -- Distribute new board codes + update LOUD call list {5}
  ((select id from calendar_events where title = 'Distribute new board codes + update LOUD call list'), 5, null),
  -- Schedule bi-monthly cleanings + weekly pool-bath cleanings {5}
  ((select id from calendar_events where title = 'Schedule bi-monthly cleanings + weekly pool-bath cleanings'), 5, null),
  -- Fall deep clean (if needed) {9}
  ((select id from calendar_events where title = 'Fall deep clean (if needed)'), 9, null),
  -- Legal retainer due {1}
  ((select id from calendar_events where title = 'Legal retainer due'), 1, null),
  -- Annual dues letter prepared for mailing {2}
  ((select id from calendar_events where title = 'Annual dues letter prepared for mailing'), 2, null),
  -- Secretary of State filing due {3} day 1
  ((select id from calendar_events where title = 'Secretary of State filing due'), 3, 1),
  -- Dues letter & invoice received by residents {3} day 1
  ((select id from calendar_events where title = 'Dues letter & invoice received by residents'), 3, 1),
  -- Insurance renewal {5}
  ((select id from calendar_events where title = 'Insurance renewal'), 5, null),
  -- Annual backflow {6}
  ((select id from calendar_events where title = 'Annual backflow'), 6, null),
  -- HOA taxes due {6} day 15
  ((select id from calendar_events where title = 'HOA taxes due'), 6, 15),
  -- Fall assessment notices mailed (if planned) {8}
  ((select id from calendar_events where title = 'Fall assessment notices mailed (if planned)'), 8, null),
  -- Termite bond due {9}
  ((select id from calendar_events where title = 'Termite bond due'), 9, null),
  -- Prepare annual HOA dues letter for residents {1}
  ((select id from calendar_events where title = 'Prepare annual HOA dues letter for residents'), 1, null),
  -- Property check — violations reporting {1,2,3,4,5,6,7,8,9,10,11,12}
  ((select id from calendar_events where title = 'Property check — violations reporting'), 1,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 2,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 3,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 4,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 5,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 6,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 7,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 8,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 9,  null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 10, null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 11, null),
  ((select id from calendar_events where title = 'Property check — violations reporting'), 12, null),
  -- Start planning next fiscal-year budget {1}
  ((select id from calendar_events where title = 'Start planning next fiscal-year budget'), 1, null),
  -- Draft budget ready to mail w/ annual meeting notice {2}
  ((select id from calendar_events where title = 'Draft budget ready to mail w/ annual meeting notice'), 2, null),
  -- Transfer FYE surplus to Reserve before March close {3}
  ((select id from calendar_events where title = 'Transfer FYE surplus to Reserve before March close'), 3, null),
  -- Begin preparation for annual HOA meeting {2}
  ((select id from calendar_events where title = 'Begin preparation for annual HOA meeting'), 2, null),
  -- Plan fall assessment notice (if needed) {7}
  ((select id from calendar_events where title = 'Plan fall assessment notice (if needed)'), 7, null),
  -- Mail annual-meeting notice to residents {3}
  ((select id from calendar_events where title = 'Mail annual-meeting notice to residents'), 3, null),
  -- Annual meeting coming up {3}
  ((select id from calendar_events where title = 'Annual meeting coming up'), 3, null),
  -- What happened in the meeting {5}
  ((select id from calendar_events where title = 'What happened in the meeting'), 5, null),
  -- What's coming {9}
  ((select id from calendar_events where title = 'What''s coming'), 9, null),
  -- Mulch (if needed) {4,10}
  ((select id from calendar_events where title = 'Mulch (if needed)'), 4,  null),
  ((select id from calendar_events where title = 'Mulch (if needed)'), 10, null),
  -- Spring flowers planned {4}
  ((select id from calendar_events where title = 'Spring flowers planned'), 4, null),
  -- Fall flowers planned {10}
  ((select id from calendar_events where title = 'Fall flowers planned'), 10, null),
  -- Pool readiness — reprogram fobs after dues received {4}
  ((select id from calendar_events where title = 'Pool readiness — reprogram fobs after dues received'), 4, null),
  -- Pool opens (swim team, then residents) {5}
  ((select id from calendar_events where title = 'Pool opens (swim team, then residents)'), 5, null),
  -- Pool closes for the year {9}
  ((select id from calendar_events where title = 'Pool closes for the year'), 9, null),
  -- End-of-year school / pool-opening party {5}
  ((select id from calendar_events where title = 'End-of-year school / pool-opening party'), 5, null),
  -- Annual kids July 4th bike parade {7} day 4
  ((select id from calendar_events where title = 'Annual kids July 4th bike parade'), 7, 4),
  -- Annual 5K run & Halloween events {10}
  ((select id from calendar_events where title = 'Annual 5K run & Halloween events'), 10, null),
  -- Annual HOA dues due {4} day 1
  ((select id from calendar_events where title = 'Annual HOA dues due'), 4, 1);
