# Feature Backlog — VP Idea Intake

> **Status:** Ideas captured + triaged into a dependency-ordered spec roadmap (triaged 2026-06-20).
> None greenlit for build yet. Each brief below is a *sketch*, not a build. Table/column names are
> illustrative — promote a brief to its own `docs/specs/*.md` spec (with a real data model + build
> sequence) when the board schedules it, in the order given under **Spec-writing roadmap**.

Source: ~13 feature ideas from the HOA vice president, plus one unifying idea (the Office Knowledge
Base, #9) that emerged while making them concrete. Goal: get them concrete and actionable so the
board can tackle them later without re-deriving intent.

---

## Coverage confirmed

**Every VP idea is captured below — nothing was dropped.** The VP's list maps onto the 14 briefs
one-to-one (the 14th, the Office Knowledge Base, is the unifying idea that ties several together):

| VP request | Brief | In-app starting point today |
|---|---|---|
| Meeting RSVP + quorum reminder | #1 | `quorum_required` setting + `meetings.present_positions` (no *pre*-meeting RSVP) |
| Past/current vendor & contract database | #2 | vendor names only as free text in `cra_quotes`; documents library |
| Past/current chair history | #3 | `positions` holds current occupant only |
| Clubhouse rental approval | #4 | `/amenities` stub |
| Membership dues >60 days follow-up | #5 | `assessment_payments` status + `/properties?status=unpaid` |
| Map/properties — count of each type | #6 | properties + map color-coded by type; no counts shown |
| Budget in tab + visual progress | #7 | **mostly built** — treasury shows budget vs. actual + % bars |
| Social events database + playbooks | #8 | nothing (operating calendar ≠ social events) |
| Templates (annual letter / PowerPoint) | #10 | documents library (`waiver \| contract \| other`) |
| Access codes (lockbox / pump room / phones) | #11 | nothing — credential-storage blocker |
| Pool common-problem how-tos + video | #12 → folds into #9 | nothing |
| Future bylaw update considerations | #13 | nothing |
| Lake maintenance / dredging timeline | #14 → ties to Operating Calendar | lake drawn on `/map` only |

---

## Dependency map

Two **foundations** that other briefs hang off — spec/build these first so dependents slot in
cleanly instead of being re-specced later:

- **Operating Calendar** — *already designed & ready to build* (`operating-calendar.md`). The home
  for recurring/annual dates. **Social events (#8)** and **Lake maintenance (#14)** feed it.
- **#9 Office Knowledge Base** — the new spine for office-keyed how-tos/narrative. **Pool how-tos
  (#12)**, **Chair/office history narrative (#3)**, and general office tips all feed it.

```
Operating Calendar ──feeds── #8 Social events
        └──feeds── #14 Lake (maintenance schedule)

#9 Knowledge Base ──feeds── #12 Pool how-tos
        ├──feeds── #3 Chair history (narrative; table is its own)
        └──feeds── #14 Lake (reference material)
```

---

## Spec-writing roadmap (dependency order)

The order to promote briefs into `docs/specs/*.md`. Tiers are sequential; items *within* a tier are
independent of each other.

**Tier 0 — Foundations (spec/build first):**
1. **Operating Calendar** — no new spec needed (see `operating-calendar.md`); build it before its
   dependents (#8, #14) are specced, or have those specs reference it.
2. **#9 Office Knowledge Base** — the spine. Spec next.

**Tier 1 — Become cheap once the foundations exist (spec after their foundation):**
3. **#12 Pool How-tos** — KB pool-tagged entries + a video-link field.
4. **#3 Chair / Office History** — `position_terms` table + KB narrative link.
5. **#8 Social Events DB / Playbooks** — `events` table feeding the Operating Calendar; cross-links KB.
6. **#14 Lake** — Operating Calendar maintenance category + KB reference material.

**Tier 2 — Independent quick wins (no foundation dependency; good momentum fillers):**
7. **#6 Property Type Counts** — pure derive over `properties`, no schema change.
8. **#7 Budget Visualization** — largely already built; likely a presentation enhancement.
   **Gate on Michelle's input** before specing — may not need a full spec.
9. **#10 Templates** — add a `template` category to the documents library.
10. **#1 Meeting RSVP + Quorum** — per-position RSVP on top of existing quorum/attendance infra.

**Tier 3 — Standalone, lower urgency:**
11. **#2 Vendor / Contract DB** — vendor master + contract expirations + dated history log.
12. **#5 Membership Delinquency Follow-up** — dated follow-up log; needs a due-date field first.
13. **#13 Bylaw Update Considerations** — small `bylaw_suggestions` running list.

**Tier 4 — Blocked (board decision required before any spec):**
14. **#11 Access / Codes Vault** — **do not spec until the board accepts storing live physical-access
    codes in a web app** (vs. a paper-list pointer). Then needs RLS-to-president/officers,
    encryption-at-rest, MFA/step-up re-auth, access logging, and rotation reminders.

---

## Decisions to resolve before specing

One checklist to take to the board / VP / Michelle so spec-writing isn't blocked mid-stream:

- [ ] **#9 KB** — edit rights: office holder + officers only, or any board member? Markdown vs. the
      existing Tiptap `RichTextEditor` for bodies?
- [ ] **#12 Pool** — video hosting: unlisted YouTube (free, recommended) vs. Supabase Storage
      (counts against free-tier budget)?
- [ ] **#3 Chair history** — capture past-holder contact info or just names? Backfill how many years?
- [ ] **#8 Social** — single playbook body vs. fixed sub-sections? Annual events auto-appear on the
      Operating Calendar?
- [ ] **#14 Lake** — own top-level section vs. nested under Grounds? Distinct from "calendar category
      + KB entries", or not?
- [ ] **#6 Counts** — count by existing `membership_type`, or a new distinct property-type concept?
      (Confirm categories with the VP.)
- [ ] **#7 Budget viz** — **Michelle:** what view is actually useful? Charting lib vs. richer CSS bars?
- [ ] **#10 Templates** — stored files only, or fill-in-the-blanks templates later?
- [ ] **#2 Vendor DB** — standalone "Records" section vs. nested under Treasury? Who can edit
      (officers+, or relevant chair too)?
- [ ] **#5 Delinquency** — add a due date to fiscal year/assessment so "days past due" can be derived
      (**Michelle**). Tie notice text to Templates (#10)?
- [ ] **#13 Bylaws** — categorize (cost-saving / clarity / compliance) or flat list?
- [ ] **#11 Access codes** — **BLOCKER:** does the board accept storing live codes at all? Which
      Supabase Auth MFA mechanism (TOTP) do we use for the step-up gate?

---

## Cross-cutting principles

These apply to most briefs below — call them out in any spec that gets promoted.

- **Data is keyed to the OFFICE, not the user.** Everything attaches to `position_id` (a fixed
  seat), never to a personal account. When a chair/officer hands off, the new occupant inherits all
  the office's vendors, history, playbooks, and how-tos automatically. The existing `positions`
  table (fixed seats, no self-registration) already gives us this for free.
- **Public repo + RLS discipline.** This is a public GitHub repo and the DB is Supabase with RLS.
  Sensitive data must **never** be granted to the `anon` role, and anything credential-like (see
  the Access vault, #11) needs encryption-at-rest plus a step-up auth gate — not just an RLS policy.
- **Reuse before building.** Several ideas extend existing tables/pages rather than adding new ones
  (RSVP → `meetings`/`pre_meeting_updates`; templates → `documents`; counts → properties page).

Each brief is: **Problem / Exists today / Proposed shape / Open questions / Size** (S / M / L).

---

## Briefs

### 1. Meeting RSVP + quorum reminder
- **Problem:** Before every meeting people ask "how many do we need for quorum?" — including the VP.
- **Exists today:** Live attendance + quorum are tracked *at* call-to-order — the runner's
  `AttendancePanel` (`components/hoa/MeetingRunner/`) shows "N voting members present — quorum: M",
  backed by `meetings.present_positions` and the `quorum_required` setting. There is no *pre*-meeting
  RSVP.
- **Proposed:** A pre-meeting RSVP (yes / no / maybe per position) surfaced before the meeting
  starts, with the quorum number shown next to the running committed count ("need N — M committed
  so far"). Reuse the `pre_meeting_updates` upsert pattern, or add a small `meeting_rsvps` table
  keyed to `meeting_id + position_id`.
- **Worth more now than when this was written:** roll call starts with *nobody* marked present, so
  the operator taps through the board at the top of every meeting. An RSVP could pre-fill that from
  the yes/no answers, turning a deliberate act into a confirmation. That makes this brief a genuine
  time-saver rather than only an informational nicety.
- **Open questions:** Show quorum number passively on the meetings list too, or only on RSVP? Do
  chairs (non-voting) RSVP for headcount but not count toward quorum? If RSVP pre-fills attendance,
  does it still require confirmation before call to order (it should — an RSVP is a prediction, and
  the minutes record who was actually in the room)?
- **Size:** S.

### 2. Vendor / Contract Database
- **Problem:** No record of vendors and contracts. The board in 5–6 years will want to know why we
  switched landscapers, who handled it, and how much the last company raised prices.
- **Exists today:** Nothing structured — vendor names only appear as free text in
  `cra_quotes.vendor_name`.
- **Proposed:** `vendors` + `vendor_contracts` (current + archived), each contract carrying:
  expiration date, cancellation/void instructions, and a dated notes/history log (issues, the
  switch story, price increases). Contract PDFs link to the existing `documents` library rather
  than a new bucket.
- **Open questions:** Standalone "Records" section vs. nested under Treasury? Who can edit —
  officers+, or also the relevant chair (e.g. Grounds for landscaping)?
- **Size:** M.

### 3. Chair / Office History
- **Problem:** When something costly comes up years later, the current holder of an office (Pool,
  Clubhouse, Tennis…) may want to consult whoever made the original decision.
- **Exists today:** `positions` holds only the *current* occupant (`display_name`). No term history.
- **Proposed:** `position_terms` (position_id, person name, start/end, notes) so a future occupant
  can see who held the seat and when. Narrative "why we decided X" detail belongs in the Knowledge
  Base (#9), linked from the term. Naturally office-keyed.
- **Open questions:** Capture contact info for past holders, or just names? Backfill how many years?
- **Size:** M.

### 4. Clubhouse Rental
- **Problem:** Rentals above ~20 guests need HOA approval; most are above that. The process is
  ad-hoc and approvals aren't documented.
- **Exists today:** `/amenities` is a stub. No rental concept.
- **Proposed:** A rental request + board-approval workflow under `/amenities/clubhouse` — guest
  count over the threshold flags "approval required", and the record documents that the board
  approved, by whom, and when.
- **Open questions:** Who submits — homeowner-facing form, or board enters on their behalf? Is
  approval a formal motion or a lightweight sign-off? What threshold exactly (VP guessed ~20)?
- **Size:** M.

### 5. Membership / Dues Delinquency follow-up
- **Problem:** No timeline for delinquent accounts. "I think Ray sent a lawyer letter to that guy…
  or was it the guy across from James?" — nobody can reconstruct what was sent and when.
- **Exists today:** `assessment_payments` has a status (paid/partial/unpaid/waived) and a `notes`
  field; the properties page filters `?status=unpaid`. No structured follow-up history.
- **Proposed:** A dated follow-up log per delinquent property (>60 days past due) — each entry: date,
  action (letter / call / lawyer notice), who handled it, outcome. A `delinquency_followups` table
  keyed to property + fiscal year. A simple "60+ days past due" view to work from.
- **Open questions:** Derive "days past due" from a due date we don't yet store — add a due date to
  the fiscal year/assessment? Tie notice text to the Templates feature (#10)?
- **Size:** M.

### 6. Map / Properties type counts
- **Problem:** Would be great to see a full count of each property type at a glance.
- **Exists today:** Properties table + interactive map are color-coded by membership type, but no
  aggregate count is shown anywhere.
- **Proposed:** Aggregate counts by membership/property type on the properties page header (and
  optionally in the map legend). Pure read/derive over the existing `properties` data — no schema
  change.
- **Open questions:** Count by `membership_type` (current field) or do we need a distinct
  "property type" concept the VP has in mind? Confirm the categories with the VP.
- **Size:** S.

### 7. Budget visualization
- **Problem:** The annual budget should live in the Treasury tab, with a visual sense of how close
  we are to budget. (Michelle, the treasurer, is the right reviewer here.)
- **Exists today:** `fiscal_years` + budget tables exist; the treasury page shows CSS progress bars
  for income/expense YTD vs budget and an expandable `CategoryBreakdown` table. No real chart, and
  the full annual budget isn't surfaced as a single view.
- **Proposed:** Surface the full annual budget in the Treasury tab and add a chart (budget vs.
  actual, % to target). Mostly a presentation layer over existing data.
- **Open questions:** Add a lightweight charting lib vs. richer CSS bars? **Get Michelle's input on
  what view is actually useful before building.**
- **Size:** S–M.

### 8. Social Events DB (playbooks)
- **Problem:** Each annual event has tribal knowledge that's lost on handoff. New social chair had
  no idea a 5k was expected; the End-of-School party needs a lifeguard (Gretchen knew to follow up,
  but a newcomer would assume United/Adam handled it); Halloween pizza must be ordered *far* in
  advance; Memorial Day — the HOA supplies the meat and you need volunteer grillers. None of this
  is written down.
- **Exists today:** `/amenities` stub. No events table.
- **Proposed:** A lightweight `events` table — name, category (Children / Adult / All), cadence
  (annual / one-off), month — with a rich-text **playbook** body per event: timeline & lead times,
  vendors + contacts, budget (incl. "we collect money for X"), gotchas, lifeguard?/who-supplies-meat,
  volunteer needs. Office-keyed to Social so it survives turnover; cross-links to the Knowledge Base
  (#9); the month/cadence can feed the Operating Calendar. Lives at `/amenities/social`.
- **Open questions:** One playbook body, or split into fixed sub-sections (vendors / budget /
  volunteers / gotchas)? Should annual events auto-appear on the Operating Calendar?
- **Size:** M.

### 9. Office Knowledge Base / Glossary *(new — unifying idea)*
- **Problem:** Lots of "how this office actually works" knowledge is gained over time and then lost
  when a seat changes hands. There's no continuously-updated home for it.
- **Exists today:** Nothing. The `documents` library stores files but not editable how-to content.
- **Proposed:** An office-keyed, board-readable, continuously-editable store of how-tos, office docs,
  and "how this job works" notes — `knowledge_entries` (position_id/office, title, body, optional
  video or doc link, tags). Two surfaces: (a) a browsable central glossary page; (b) a **"Help /
  How-to" paged modal** on each My Office page (`/committee/[chair]`, `/board/[position]`) that
  filters to that office's entries. Any board member can add to it as they learn. This is the home
  that Pool how-tos (#12) and office tips feed into, and that chair history (#3) links to for
  narrative detail.
- **Open questions:** Edit rights — only the office holder + officers, or any board member? Markdown
  vs. the existing Tiptap rich-text editor (`RichTextEditor`) for bodies?
- **Size:** M.

### 10. Templates
- **Problem:** The board scrambled to find an annual letter template and an annual PowerPoint
  template. Having them on hand would save real time.
- **Exists today:** `documents` library with types `waiver | contract | other`.
- **Proposed:** Add a `template` type/category to the existing documents library for the annual
  letter, annual PowerPoint, and future templates. Likely the smallest build — a new category plus
  uploads, reusing `DocumentUpload` and signed-URL downloads.
- **Open questions:** Just stored files, or fill-in-the-blanks templates later? Tie letter templates
  to the delinquency notices (#5)?
- **Size:** S.

### 11. Access / Codes vault
- **Problem:** Access info is scattered — lockbox locations and codes (and *which* box is which),
  the pump room code, the pool landline, United's number. The board needs one place for it.
- **Exists today:** Nothing.
- **Proposed:** `access_entries` (label, kind: `contact | code | location`, value, visibility).
  Phone numbers (United, pool landline) and locations are **low-risk** and broadly readable. Actual
  **codes (lockbox / pump room / gate) are credentials** and must, as hard requirements:
  - be restricted to **president / officer only** via RLS, and **never** granted to the `anon` role;
  - be **encrypted at rest** (e.g. `pgcrypto` column encryption) so a DB leak doesn't expose them;
  - sit behind an **MFA / step-up re-auth gate** that's required before a code is revealed in the UI;
  - write an **access log** when a code is viewed;
  - prompt a **rotate-the-codes reminder** after any personnel change.
- **Open questions (BLOCKER before any build):** Does the board accept storing live physical-access
  codes in a web app at all, vs. a "contacts + where the paper list lives" pointer? Which MFA
  mechanism does Supabase Auth give us cheaply (TOTP enrollment)?
- **Size:** L.

### 12. Pool how-tos
- **Problem:** Common pool problems (e.g. how to turn off the water pump) should have a documented
  fix, ideally with a short video.
- **Exists today:** Nothing.
- **Proposed:** Folds into the Knowledge Base (#9). The Pool chair's My Office "Help / How-to" modal
  surfaces pool-tagged entries — each can carry a short text fix plus a video link. No separate build
  beyond a video-link field on `knowledge_entries`.
- **Open questions:** Video hosting — **unlisted YouTube link (free, recommended)** vs. Supabase
  Storage (counts against the free-tier storage budget; see `docs/services.md`).
- **Size:** Covered by #9 + a video-link field.

### 13. Future Bylaw Update Considerations
- **Problem:** Small bylaw-improvement ideas get lost (e.g. the lawyer suggested allowing digital-only
  communication/votes so the HOA can stop paying to mail letters). A bylaw revision is a big, costly
  project — when we do one, we want a complete running list of everything that's come up.
- **Exists today:** Nothing.
- **Proposed:** A simple running list — `bylaw_suggestions` (item, rationale, date added, source).
  Low-stakes, append-mostly. Board-readable.
- **Open questions:** Any categorization (cost-saving / clarity / compliance), or just a flat list?
- **Size:** S.

### 14. Lake
- **Problem:** The lake may warrant its own section with a detailed timeline and recurring
  maintenance schedule (e.g. dredging).
- **Exists today:** The lake/pond is drawn on the `/map` polygons, nothing more.
- **Proposed:** A dedicated lake section with a maintenance timeline + recurring schedule. Scheduled
  maintenance dates can feed the Operating Calendar; background/reference material lives in the
  Knowledge Base (#9).
- **Open questions:** Its own top-level section, or nested under Grounds / amenities? Is this distinct
  enough from the Operating Calendar to need its own home, or just a calendar category + KB entries?
- **Size:** M.

---

## How these relate

A few ideas converge, which should shape build order:

- **Knowledge Base (#9) is the spine.** Pool how-tos (#12), office tips, and chair-history narrative
  (#3) all feed it. Build #9 first and several others become content, not code.
- **Operating Calendar tie-ins.** Social events (#8) and Lake maintenance (#14) both want to surface
  dated items — coordinate with `docs/specs/operating-calendar.md` rather than duplicating a calendar.
- **Documents library extensions.** Templates (#10) and vendor contracts (#2) both lean on the
  existing `documents` bucket + signed-URL pattern.
- **Treasury cluster.** Budget viz (#7) and delinquency follow-up (#5) both extend the treasury /
  assessments data; Michelle (treasurer) reviews both.
