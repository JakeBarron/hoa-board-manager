-- supabase/migrations/0012_properties.sql

create table properties (
  id               uuid primary key default gen_random_uuid(),
  lot_number       integer not null unique,
  first_name       text,
  last_name        text not null,
  account_number   text,
  street_address   text,
  membership       text,
  membership_type  text,
  annual_lease_fee numeric(10,2),
  email_1          text,
  email_2          text,
  key_fob_1        text,
  key_fob_2        text,
  sayor            boolean not null default false
);

alter table properties enable row level security;

-- Voting members (president, officer, member) can read.
-- Committee chairs (role = 'chair') are excluded — they do not need resident PII.
create policy "voting member read"
  on properties for select
  to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer', 'member')
    )
  );

-- Officer+ can update rows. No UI yet — policy ready for future edit form.
create policy "officer update"
  on properties for update
  to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer')
    )
  )
  with check (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer')
    )
  );

-- No insert or delete policies.
-- Data is seeded via service role key only (supabase/seed.ts).
