-- Add the Grounds position, a voting board member accidentally omitted from the
-- initial schema. The Supabase Auth user must be created separately via seed.

-- ─── Extend name constraint ───────────────────────────────────────────────────
alter table positions drop constraint positions_name_check;
alter table positions add constraint positions_name_check
  check (name in (
    'president','vp','secretary','treasurer',
    'pool','membership','tennis','social','grounds',
    'web','architecture','welcoming','clubhouse','cra'
  ));

-- ─── Insert position row ──────────────────────────────────────────────────────
insert into positions (name, email, role, is_voting_member)
values ('grounds', 'grounds@yourhoa.com', 'member', true)
on conflict (name) do nothing;
