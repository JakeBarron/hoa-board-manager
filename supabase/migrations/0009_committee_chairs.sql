-- Add chair role and five committee chair positions.
-- Also adds reminder_sent_at to meetings for reminder tracking.

-- ─── Extend role constraint ───────────────────────────────────────────────────
alter table positions drop constraint positions_role_check;
alter table positions add constraint positions_role_check
  check (role in ('president','officer','member','chair'));

-- ─── Extend name constraint ───────────────────────────────────────────────────
alter table positions drop constraint positions_name_check;
alter table positions add constraint positions_name_check
  check (name in (
    'president','vp','secretary','treasurer',
    'pool','membership','tennis','social',
    'web','architecture','welcoming','clubhouse','cra'
  ));

-- ─── Reminder tracking on meetings ───────────────────────────────────────────
alter table meetings
  add column reminder_sent_at timestamptz default null;

-- ─── Insert the five chair position rows ─────────────────────────────────────
-- Auth accounts are created separately via pnpm seed.
insert into positions (name, email, role) values
  ('web',          'web@yourhoa.com',          'chair'),
  ('architecture', 'architecture@yourhoa.com', 'chair'),
  ('welcoming',    'welcoming@yourhoa.com',    'chair'),
  ('clubhouse',    'clubhouse@yourhoa.com',    'chair'),
  ('cra',          'cra@yourhoa.com',          'chair');
