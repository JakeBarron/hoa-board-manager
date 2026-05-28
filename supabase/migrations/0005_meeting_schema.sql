-- Meeting runner schema: meetings, motions, per-member votes, and document links.
-- Design decisions:
--   - Any voting member can call a meeting; a second is required before it starts.
--   - All motions (including call-to-order) require a proposer + seconder.
--   - Votes are immutable once a meeting is adjourned — no update/delete policies.
--   - recorded_by on motion_votes provides an audit trail for president overrides.
--   - Quorum threshold lives in the settings table (key = 'quorum_required').

-- ─── Meetings ────────────────────────────────────────────────────────────────

create table meetings (
  id                uuid primary key default gen_random_uuid(),
  meeting_date      date not null,
  called_by         uuid not null references positions(id),
  seconded_by       uuid references positions(id),
  seconded_at       timestamptz,
  started_at        timestamptz,
  adjourned_at      timestamptz,
  -- 'pending'    = called but not yet seconded / started
  -- 'in_progress' = timer running, minutes being recorded
  -- 'adjourned'  = closed; all votes and minutes are locked
  status            text not null default 'pending'
                    check (status in ('pending', 'in_progress', 'adjourned')),
  minutes_content   text,           -- WYSIWYG HTML content authored in-app
  minutes_drive_url text,           -- Google Drive URL after manual upload
  created_at        timestamptz not null default now()
);

-- Google Drive links for the meeting (primary minutes + any numbered amendments)
create table meeting_documents (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references meetings(id) on delete cascade,
  name             text not null,
  drive_url        text not null,
  doc_type         text not null default 'minutes'
                   check (doc_type in ('minutes', 'amendment')),
  amendment_number int,             -- null for primary minutes, 1/2/3 for amendments
  created_at       timestamptz not null default now()
);

-- ─── Motions ─────────────────────────────────────────────────────────────────

create table motions (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  title        text not null,
  description  text,
  proposed_by  uuid not null references positions(id),
  seconded_by  uuid references positions(id),
  proposed_at  timestamptz not null default now(),
  seconded_at  timestamptz,
  -- 'proposed'  = waiting for a second
  -- 'seconded'  = seconded, voting not yet open
  -- 'voting'    = voting in progress
  -- 'passed'    = vote closed, motion carried
  -- 'failed'    = vote closed, motion did not carry
  -- 'tabled'    = deferred without a vote
  status       text not null default 'proposed'
               check (status in ('proposed', 'seconded', 'voting', 'passed', 'failed', 'tabled')),
  quorum_met   boolean,             -- set when voting closes
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);

-- ─── Per-member votes ────────────────────────────────────────────────────────

create table motion_votes (
  id          uuid primary key default gen_random_uuid(),
  motion_id   uuid not null references motions(id) on delete cascade,
  position_id uuid not null references positions(id),
  vote        text not null check (vote in ('yay', 'nay', 'absent', 'no_vote')),
  -- recorded_by = position_id when self-cast; president's id when overriding for absent member
  recorded_by uuid not null references positions(id),
  voted_at    timestamptz not null default now(),
  unique (motion_id, position_id)   -- one vote per position per motion
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table meetings        enable row level security;
alter table meeting_documents enable row level security;
alter table motions         enable row level security;
alter table motion_votes    enable row level security;

-- Meetings: all authenticated can read and call (insert); status updates restricted
create policy "meetings_select" on meetings for select to authenticated using (true);
create policy "meetings_insert" on meetings for insert to authenticated with check (true);
-- Only the caller or president can update a meeting (second it, start it, adjourn it)
create policy "meetings_update" on meetings for update to authenticated
  using (called_by = (select id from current_position()) or is_president());

-- Meeting documents: any authenticated can read/insert; no delete
create policy "meeting_docs_select" on meeting_documents for select to authenticated using (true);
create policy "meeting_docs_insert" on meeting_documents for insert to authenticated with check (true);

-- Motions: any authenticated can read and propose; only proposer or president can update
create policy "motions_select" on motions for select to authenticated using (true);
create policy "motions_insert" on motions for insert to authenticated with check (true);
create policy "motions_update" on motions for update to authenticated
  using (proposed_by = (select id from current_position()) or is_president());

-- Motion votes: members cast their own vote; president can cast on behalf of absent members.
-- No update or delete — votes are immutable.
create policy "motion_votes_select" on motion_votes for select to authenticated using (true);
create policy "motion_votes_insert" on motion_votes for insert to authenticated
  with check (
    position_id = (select id from current_position())
    or is_president()
  );

-- ─── Grants ──────────────────────────────────────────────────────────────────

grant all on meetings, meeting_documents, motions, motion_votes
  to anon, authenticated, service_role;
