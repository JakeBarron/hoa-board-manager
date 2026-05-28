-- Configurable HOA settings stored in the DB so values can change without a code deploy.

create table settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

alter table settings enable row level security;

-- All authenticated board members can read settings
create policy "settings_select" on settings for select to authenticated using (true);
-- Only president can change settings
create policy "settings_update" on settings for update to authenticated using (is_president());

grant all on settings to anon, authenticated, service_role;

-- Seed defaults
insert into settings (key, value, description) values
  ('quorum_required', '5',                  'Minimum voting members present for a board vote to be valid'),
  ('hoa_name',        'East Spring Lake',   'HOA display name used throughout the portal'),
  ('board_size',      '8',                  'Total number of voting board positions');
