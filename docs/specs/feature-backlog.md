# Feature Backlog — VP Idea Intake

> **Status:** Ideas captured, none greenlit. (Intake 2026-06-15.)
> Each brief below is a *sketch*, not a build. Table/column names are illustrative — promote a
> brief to its own `docs/specs/*.md` spec (with a real data model + build sequence) when the board
> schedules it.

Source: ~13 feature ideas from the HOA vice president, plus one unifying idea (the Office Knowledge
Base, #9) that emerged while making them concrete. Goal: get them concrete and actionable so the
board can tackle them later without re-deriving intent.

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
- **Exists today:** Live attendance + quorum are tracked *at* call-to-order — `MeetingRunnerModal`
  shows "X of Y present — quorum: N", backed by `meetings.present_positions` and the
  `quorum_required` setting. There is no *pre*-meeting RSVP.
- **Proposed:** A pre-meeting RSVP (yes / no / maybe per position) surfaced before the meeting
  starts, with the quorum number shown next to the running committed count ("need N — M committed
  so far"). Reuse the `pre_meeting_updates` upsert pattern, or add a small `meeting_rsvps` table
  keyed to `meeting_id + position_id`.
- **Open questions:** Show quorum number passively on the meetings list too, or only on RSVP? Do
  chairs (non-voting) RSVP for headcount but not count toward quorum?
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
