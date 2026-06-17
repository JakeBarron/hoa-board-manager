# Operating Calendar — Spec

> **Status:** Designed, ready to build. Design session completed 2026-06-15 (grill-me),
> refined 2026-06-15 (brainstorming — open data questions resolved, see "Resolved
> decisions"). Schema/routes/components not yet written. **No longer blocked:** the seed
> draft ships as-is in `0019` and Jake red-lines it post-deploy via the admin CRUD UI.

## Resolved decisions (2026-06-15 brainstorming)

- **Seed strategy:** the draft below ships as-is in `0019` (clearly-delineated, easy-to-edit
  block). Jake corrects any wrong data **post-deploy via admin CRUD** — which is exactly why
  CRUD is in v1. The migration is **not** blocked on a red-line.
- **Annual meeting dropped from seed:** the `Board | Annual HOA meeting held` event is
  **removed**. The annual meeting will surface in the calendar via a future
  **meetings→calendar integration** (scheduling a meeting makes it appear) — see fast-follow.
  Prep/notice tasks (Board "begin preparation", Secretary "mail notice", Newsletter items)
  **stay** — they are operational tasks, not the meeting itself.
- **Secretary of State filing:** locked to **March 1** (`month=3, day_of_month=1`).
- **"Upcoming" wraps the year:** the dashboard widget + page upcoming-sort roll past Dec 31
  into next year's earliest events so the widget never empties in Q4. NOTE this makes the
  page's **month grouping (plain Jan–Dec order)** and the widget's **upcoming sort (wrapping)**
  two distinct orderings — keep them separate.
- **Free-text responsible parties** ("Gibbs", "Executive Board", "Kids Social") stay as
  free text, editable via CRUD.

### Build defaults (documented so parallel agents don't each re-decide)

- **Color** = a **hex string** (e.g. `#3b82f6`) on `responsibility_areas.color`, rendered via
  inline `style` on area dots/badges/filter chips. Tailwind v4 `@theme` tokens are build-time
  fixed, so admin-editable colors must be free values, not utility classes.
- **`calendar_events.area_id`** is `not null` with **`on delete restrict`** — an area with
  events cannot be deleted (CRUD surfaces a friendly error). `event_occurrences` keep
  `on delete cascade` from their parent event.
- **Seed mechanism:** insert areas first; insert events with
  `area_id = (select id from responsibility_areas where name = …)`; insert occurrences with
  `event_id = (select id from calendar_events where title = …)`. Event titles are unique in
  the draft, so the lookups are unambiguous.
- **RLS editor check:** add a `security definer` helper `is_calendar_editor()` mirroring
  `0018`'s `is_treasury_editor()`, returning true for `role in ('president','officer')`.
- **Helpers** stay pure with **no `date-fns`** in v1 (it lands with the grid fast-follow):
  - `effectiveDate(occ, year)` → `day_of_month ?? lastDayOfMonth(year, month)`, last day via
    `new Date(year, month, 0).getDate()`.
  - `upcomingOccurrences(occurrences, today)` → year-wrapping ascending sort (+ wrap-case test).
  - `groupByMonth(occurrences)` → plain Jan–Dec calendar order (no wrap).

## What it is

A board-facing, **all-areas operating calendar**: the recurring annual cycle of running
the HOA — maintenance, governance, financial deadlines, social events, grounds, pool —
surfaced in one readable place so nothing slips and the knowledge survives board-term
hand-offs. **Readable by everyone** (all authenticated users, chairs included).

> **Scope correction (2026-06-15):** This started as a narrow *treasurer obligations*
> tracker. Jake provided the HOA's actual operating-calendar spreadsheet (~60 events
> across 11 responsibility areas), which reframed it into the board-wide operations
> calendar described here. The earlier "treasurer-only / evergreen single-date /
> date-rule-engine / chairs-excluded / FY-scoped" decisions are **superseded** by the
> design below.

## Why (problem being solved)

The annual cycle (when dues letters mail, when the annual meeting is noticed, when taxes
are due, when HVAC filters get changed, when the pool opens) lives in a spreadsheet and
in people's heads; hand-offs between board terms lose it. One canonical, color-coded,
everyone-readable calendar fixes that. Also reads to a portfolio reviewer as a real
operational feature.

---

## Design decisions (locked)

**Scope & access**
- Board-wide, **all responsibility areas**. **Read = all authenticated users including
  committee chairs** (no chair redirect — this is the one shared page everyone reads).
- **Edit = president/officer** (`canEditAll`) for v1. Future: per-area owners edit their
  own area; fuller RBAC.

**Time model**
- HOA **fiscal year is April 1 – March 31** (a treasury concern). This feature is
  **decoupled from `fiscal_years`** — it displays a **calendar year (Jan–Dec)**, matching
  the source spreadsheet. Events are **evergreen** (identical every year).
- v1 **anchors to the current calendar year**; "upcoming" is computed relative to today.
  No year picker in v1 (every year renders the same chart until completion exists).

**Recurrence & dates (normalized — model B)**
- An **event** recurs in a **set of months**, stored as child **occurrence** rows — not
  an array column. One event, N occurrences (e.g. "Property Check" → 12 occurrences;
  "Pest Control" → {Mar, Jun, Sep, Dec}; "HVAC filter" → {Jan, May, Jul}).
- Each occurrence has an optional **`day_of_month`**. **Effective date = `day_of_month`
  if set, otherwise the last day of that month** (a "by month-end" default deadline).
  Hard dates keep their day: dues **Apr 1**, taxes **Jun 15**, letters by **Mar 1 / Feb 1**.
- **`date-fns`** is the chosen tool for calendar/grid date math (tree-shakeable, immutable,
  TS-native); **introduce it at first real use** (the grid / end-of-month resolution), not
  speculatively. **Do not retrofit `lib/dates.ts`** (pure, tested — leave it).

**Color & filtering**
- The **Responsibility Area** is the **color + filter axis**, modeled as an **editable
  lookup table** (not an enum) so admins add/recolor areas as data. **"Homeside" (the
  management company) is just another area row** — first-class, like Clubhouse or Pool.

**Completion**
- **Not in v1** — v1 is **read-only** (a shared reference) **plus admin CRUD** (the seed
  needs adjusting, so add/edit/delete of events + areas ships in v1).
- **Fast-follow:** `event_occurrence_completions` keyed `(occurrence_id, year)`, binary +
  `completed_by_position_id` + `completed_at`. The occurrences table is the anchor.
  Overdue/done coloring arrives with completion; **v1 colors by area only**.

**Templates**
- Optional **`template_url`** (Google Drive link) per event, rendered as a link. No upload
  flow in v1. Future: migrate off Google Docs; managed/uploaded templates in `documents`.

**Reminders**
- v1 passive **"upcoming"** ordering only (no overdue — needs completion). **Scheduled
  email cron = future** (needs Vercel Cron + Resend headroom; `mailto` judged not useful).

**Placement & views**
- Standalone **`/calendar`** full page **+ a home dashboard widget** ("top ~5 upcoming").
  Future: a generalized **embeddable-widget pattern** for pages.
- v1 view = **readable month-grouped list/sections** (grouped by month, color by area,
  filter by area). The **actual month-grid calendar** is the **fast-follow** (best
  human-readable format; will use `date-fns`); ultimately both via tabs. Build extensible.

**Audit trail**
- `created_by_position_id` + `created_at`, `updated_by_position_id` + `updated_at` on
  events. Future: full change-log / per-field history.

---

## Data model (sketch — finalize at build)

```
responsibility_areas
  id            uuid pk
  name          text not null            -- "Clubhouse", "Homeside", "Treasurer", ...
  color         text not null            -- token or hex for the area's color
  sort_order    int  not null default 0
  -- RLS: read all-authenticated; write president/officer. Relationships: [] in types.

calendar_events
  id                     uuid pk
  area_id                uuid fk -> responsibility_areas
  title                  text not null
  responsible_party      text null        -- free text: "Clubhouse Chair", "Homeside", "Gibbs"
  notes                  text null        -- clarifying instructions / embedded deadlines
  template_url           text null        -- Google Drive link
  created_by_position_id uuid null fk -> positions
  created_at             timestamptz default now()
  updated_by_position_id uuid null fk -> positions
  updated_at             timestamptz default now()

event_occurrences
  id            uuid pk
  event_id      uuid fk -> calendar_events (on delete cascade)
  month         int  not null check (month between 1 and 12)
  day_of_month  int  null check (day_of_month between 1 and 31)
  -- effective date(year) = day_of_month ?? lastDayOfMonth(year, month)

-- FAST-FOLLOW (not v1):
event_occurrence_completions
  id                      uuid pk
  occurrence_id           uuid fk -> event_occurrences
  year                    int not null
  completed_by_position_id uuid fk -> positions
  completed_at            timestamptz
  unique (occurrence_id, year)
```

Conventions: every table `enable row level security`, add read (all-authenticated) +
write (president/officer) policies, `grant all` to `anon, authenticated, service_role`
(see `0018`). Migration file: **`0019_operating_calendar.sql`**. Every table type in
`types/database.ts` needs `Relationships: []`.

---

## Seed draft (from Jake's spreadsheet — RED-LINE THIS)

Collapsed from the ~60-row sheet into events + recurrence. **Months** in braces; a bare
month with no day = "by month-end." Areas are the lookup rows. **Please correct
responsible parties, months, and the few specific days.**

### Areas (lookup rows)
`Clubhouse, Membership, Homeside, Treasurer, Board, Secretary, Newsletter, Grounds, Pool, Social, Residents` — assign each a color at build.

### Events

| Area | Title | Months | Day | Responsible | Notes |
|---|---|---|---|---|---|
| Clubhouse | Monthly clubhouse cleaning | {1} | — | Clubhouse Chair | (May task schedules ongoing cleanings) |
| Clubhouse | Replace HVAC filter | {1,5,7} | — | Clubhouse Chair | |
| Clubhouse | Termite bait station check | {1} | — | Clubhouse Chair | |
| Clubhouse | Inventory supply closet & restock (summer rental prep) | {2} | — | Clubhouse Chair | paper goods, filters, lightbulbs |
| Clubhouse | HVAC service check/service & change filter | {3,10} | — | Clubhouse Chair | |
| Clubhouse | Pest control visit (interior/exterior/pool baths) | {3,6,9,12} | — | Clubhouse Chair | |
| Clubhouse | Porch & furniture pressure-washing | {4} | — | Clubhouse Chair | coordinate w/ tennis court washing |
| Clubhouse | Distribute new board codes + update LOUD call list | {5} | — | Clubhouse Chair | add new members, remove old |
| Clubhouse | Schedule bi-monthly cleanings + weekly pool-bath cleanings | {5} | — | Clubhouse Chair | week before pool opens → Sept |
| Clubhouse | Fall deep clean (if needed) | {9} | — | Clubhouse Chair | |
| Homeside | Legal retainer due | {1} | — | Homeside | |
| Homeside | Annual dues letter prepared for mailing | {2} | — | Homeside | due by 3/1; Homeside mails to residents |
| Homeside | Secretary of State filing due | {3} | 1 | Homeside | due 3/1 |
| Homeside | Dues letter & invoice received by residents | {3} | 1 | Homeside | |
| Homeside | Insurance renewal | {5} | — | Homeside | |
| Homeside | Annual backflow | {6} | — | Homeside | Christy → Adams to schedule |
| Homeside | HOA taxes due | {6} | 15 | Homeside | |
| Homeside | Fall assessment notices mailed (if planned) | {8} | — | Homeside | |
| Homeside | Termite bond due | {9} | — | Homeside | |
| Membership | Prepare annual HOA dues letter for residents | {1} | — | Membership | due to Homeside by 2/1; prior yr avail for draft |
| Membership | Property check — violations reporting | {1,2,3,4,5,6,7,8,9,10,11,12} | — | Membership | monthly |
| Treasurer | Start planning next fiscal-year budget | {1} | — | Treasurer | |
| Treasurer | Draft budget ready to mail w/ annual meeting notice | {2} | — | Treasurer | else post to website for resident review |
| Treasurer | Transfer FYE surplus to Reserve before March close | {3} | — | Treasurer / Homeside | |
| Board | Begin preparation for annual HOA meeting | {2} | — | Executive Board | |
| Board | Plan fall assessment notice (if needed) | {7} | — | Membership & Homeside | |
| Secretary | Mail annual-meeting notice to residents | {3} | — | Secretary | slate + proxy ballot + draft-budget info; Homeside mails 10–30 days prior |
| Newsletter | Annual meeting coming up | {3} | — | Newsletter | |
| Newsletter | What happened in the meeting | {5} | — | Newsletter | |
| Newsletter | What's coming | {9} | — | Newsletter | |
| Grounds | Mulch (if needed) | {4,10} | — | Grounds | |
| Grounds | Spring flowers planned | {4} | — | Gibbs | |
| Grounds | Fall flowers planned | {10} | — | Gibbs | |
| Pool | Pool readiness — reprogram fobs after dues received | {4} | — | Pool Chair | add new SAYOR, remove old |
| Pool | Pool opens (swim team, then residents) | {5} | — | Pool Chair | |
| Pool | Pool closes for the year | {9} | — | Pool Chair | |
| Social | End-of-year school / pool-opening party | {5} | — | Social (Kids) | last day of school |
| Social | Annual kids July 4th bike parade | {7} | 4 | Social (Kids) | |
| Social | Annual 5K run & Halloween events | {10} | — | Social | |
| Residents | Annual HOA dues due | {4} | 1 | Residents | late after Apr 30; mail or pay online to Homeside |

**Open data questions — RESOLVED (2026-06-15):** (1) annual meeting → dropped from seed,
deferred to meetings→calendar integration; (2) Secretary of State → **March 1**; (3) any
month-end defaults that should carry a specific day → left as month-end, Jake fixes via CRUD
post-deploy; (4) "Gibbs" / "Executive Board" / "Kids Social" → confirmed free text.

---

## v1 build sequence

1. Migration `0019` — three tables + RLS/grants + seed (areas, events, occurrences).
2. `types/database.ts` — three table types (`Relationships: []`).
3. Pure helpers — occurrence effective-date (`day_of_month ?? lastDayOfMonth`), "upcoming"
   sort, month grouping. Tests co-located.
4. `/calendar` page — month-grouped read view, color + filter by area; current calendar year.
5. Admin CRUD — create/edit/delete events (+ occurrences) and areas; president/officer.
6. Dashboard widget — "top ~5 upcoming" by effective date from today.

**Fast-follow (not v1):**
- Completion (`event_occurrence_completions` + mark-done UI + overdue/done coloring + year
  navigation).
- The actual **month-grid calendar** view (tabs) using `date-fns`.
- **Meetings→calendar integration** — scheduling a meeting (meetings feature) surfaces it on
  the calendar, replacing the dropped static "annual HOA meeting held" event.

## Suggested reading order for the implementer

1. This file.
2. `lib/dates.ts` + tests — existing date vocabulary (Nth-weekday etc.); the new grid math
   uses `date-fns`, but don't rip this out.
3. `supabase/migrations/0018_treasury_schema.sql` — RLS/grant conventions to copy.
4. `components/hoa/PropertiesView` + `PropertyTable` — existing filterable-table pattern.
5. `CLAUDE.md` — stack, conventions, build-status map.
