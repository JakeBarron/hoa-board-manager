# Agenda → Meetings Integration — Spec

> **Status:** Designed, ready to build. Brainstorming session 2026-06-16, stress-tested by an
> adversarial review of the live code. Replaces the placeholder "Pre-Meeting / Agenda Merge"
> row in the specs index. Schema migration + code not yet written.

## What it is

The agenda stops being a separate page you admire and becomes the **scaffold the secretary
works from during the meeting**. Instead of the minutes editor opening blank, it opens
pre-filled with the standard meeting order, the board/committee pre-meeting updates folded
in, and any new business — so someone who has never run a meeting can follow it top to
bottom. Alongside that, meetings become a **sequential queue** with one unambiguous "NEXT"
meeting that everyone is keyed to, removing the "which meeting am I updating?" confusion.

Three user goals drive this:

1. The agenda should **guide the runner** — pre-populate the rich-text minutes editor on
   meeting start with who called to order, board reports (pool, treasury, …), committee
   reports, and new business.
2. There should always be **one NEXT meeting** everyone works toward, with no date-picker
   confusion before a meeting is started.
3. Agenda should be **part of meetings**, not a separate top-level page.

## Resolved decisions (2026-06-16 brainstorming)

- **Scaffold built fresh at start.** No stored, pre-editable agenda draft. The full scaffold
  (standard sections + every current pre-meeting update + new business) is assembled the
  moment the meeting starts, always from the latest data — nothing can go stale or clobber.
- **New Business captured by the runner, not pre-edited by officers.** The "officers edit the
  agenda beforehand" idea is dropped. New Business is entered by the person actually starting
  the meeting, as the **first step** of the start wizard:
  **New Business → Attendance → Call to Order → running editor.** Itemized add/remove panel
  (title + optional note), skippable with zero items, runner-only.
- **Meeting queue with a single NEXT.** NEXT = the earliest-dated `pending`/`in_progress`
  meeting. It is the one meeting the pre-meeting form, the prep view, and Start all target.
- **Append-only scheduling.** `createMeeting` requires the new date to be **strictly after the
  latest already-scheduled meeting** — you can queue meetings but never insert before the
  queue. Date order == queue order, so NEXT is always unambiguous.
- **Cleared in order.** Start operates on the NEXT (earliest) meeting; you adjourn it before
  the one behind it becomes NEXT. At most one `in_progress` at a time.
- **Auto-schedule on adjourn, refill-only.** When a meeting adjourns, if **no other pending
  meeting remains**, auto-create the next one from `meeting_cadence`. If meetings are already
  queued, do nothing. The queue is never empty in steady state; the only "no meeting" state is
  before the very first meeting is ever scheduled.
- **Reschedule preserves queue order.** A reschedule must land strictly after the previous
  pending meeting and strictly before the next pending meeting — it stays in its slot, so NEXT
  never silently changes.
- **Pre-meeting updates re-keyed to the meeting** (`meeting_id`), not a bare date. The form
  drops the date picker for everyone (officers included) and always targets NEXT.
- **Submitting with zero meetings is disallowed** (accepted): the form shows "No meeting
  scheduled yet" only before the first-ever meeting; officers get a Schedule link. After that,
  auto-schedule guarantees a NEXT.
- **Prep view replaces `/agenda`.** The NEXT meeting's detail page (`/meetings/[id]`) gains a
  prep section; the `/agenda` route + Sidebar item are removed; `/pre-meeting` redirects to the
  prep view.

## Data model changes

### Migration (next number, e.g. `0019`/`0020` — check current max)

1. **`pre_meeting_updates.meeting_id`** — `uuid` FK → `meetings(id)` `on delete cascade`.
   - New unique constraint `(position_id, meeting_id)`. (Cascade is correct: `cancelMeeting`
     hard-deletes, so attached updates are removed cleanly — unlike today's date-keyed rows,
     which would orphan on cancel.)
   - `meeting_date` kept **nullable** for legacy rows (no longer written by new code).
   - **Backfill:** `update pre_meeting_updates u set meeting_id = m.id from meetings m where
     m.meeting_date = u.meeting_date` — but a date can map to two meetings (dates are reused
     once a prior meeting is adjourned). **Tie-break:** prefer the non-adjourned meeting, else
     the most recently created one. Spell the `distinct on`/subquery out in the migration.
     Legacy rows that match no meeting keep `meeting_id = NULL` and become historical/invisible
     to new readers — acceptable.
   - RLS: the existing split `pre_meeting_insert` / `pre_meeting_update` policies key on
     `current_position() = position_id` and are unaffected by the column add. Verify the
     upsert (`onConflict: "position_id,meeting_id"`) still satisfies both policy paths.

2. **Partial unique index on `meetings`** to make "one queued meeting per date" a DB
   invariant and prevent concurrent-adjourn duplicates:
   `create unique index meetings_one_pending_per_date on meetings (meeting_date) where status
   in ('pending','in_progress')`.

## Server action changes (`actions/`)

### `meetings.ts`

- **`createMeeting`** — replace the same-date-only conflict check with **append-only**: reject
  unless `meetingDate` is strictly greater than the max `meeting_date` among all
  `pending`/`in_progress` meetings (and still future, ET). Keep `revalidatePath` set; drop the
  now-dead `/agenda` revalidation, add the prep view.
- **`rescheduleMeeting`** — add the **order-preserving** constraint: `newDate` must be `>` the
  previous pending meeting's date and `<` the next pending meeting's date (whichever exist),
  in addition to future + still-pending. Repoint `/agenda` revalidation → prep view.
- **Call-to-order / scaffold seed** — `callToOrder` (or a thin new action it calls) must:
  - Enforce **earliest-first**: reject if an earlier `pending` meeting exists (the "cleared in
    order" invariant; today every row can Start independently — client-only guard).
  - Build the scaffold via the pure `buildMeetingScaffold(...)` from current data (attendance,
    caller/seconder names, prior-minutes link, board+committee `pre_meeting_updates` for this
    `meeting_id`, the runner's new-business items), store it as `minutes_content`, and
    **return the HTML** so the client can seed the editor. Make it idempotent (don't re-seed if
    `minutes_content` already non-empty — protects against re-invocation / resume).
- **`adjournMeeting`** — after marking adjourned, **best-effort auto-schedule**:
  - Only if no other `pending` meeting exists.
  - Compute the next date with `getUpcomingMeetingDates(cadence, 1)`, where `cadence =
    settings.meeting_cadence ?? "3:2"` (never silently fall through to Monday).
  - Compute "today" in `America/New_York` to match the rest of the file; guard against a
    past/`today` result.
  - Insert guarded by the partial unique index; on failure, **swallow the error** — the adjourn
    must still succeed (return the existing `uploadError` shape, optionally add a
    `scheduleError`). Revalidate `/meetings`, `/dashboard`, and the prep view.
- **Remove `startOrResumeMeeting`** — vestigial (keys on `today`, not called by the runner).
  Confirm no remaining callers before deleting.

### `pre-meeting.ts`

- **`submitPreMeetingUpdate(positionId, meetingId, content)`** — upsert on
  `(position_id, meeting_id)`. Revalidate the prep view + the My Office/committee pages.

## The scaffold (`lib/`)

- **`buildMeetingScaffold(...)`** — a **pure** function (co-located `*.test.ts`, no DB, mirrors
  `lib/dates.ts` / `lib/reminder.ts` style) returning the minutes HTML:

  > **Call to Order** — Called to order by {caller}, seconded by {seconder}. Present: {names}
  > ({quorum met / not met}).
  > **Approval of Prior Minutes** — {last minutes date + link, or "No prior minutes on file"}.
  > **Board Reports** — one line per board position in `POSITION_ORDER`: `{label}: {update}` or
  > `{label}: No update submitted`.
  > **Committee Reports** — same, over `COMMITTEE_ORDER`.
  > **New Business** — the runner's items (title + optional note), or "None".
  > **Adjournment** —

  Inputs are plain data (names already formatted via `formatPersonName`, updates already
  fetched). Reuse the existing `POSITION_ORDER` / `COMMITTEE_ORDER` / label constants from
  `agenda/page.tsx` — extract them to a shared module so the scaffold and the prep view both
  use them.

## Runner changes (`components/hoa/MeetingRunnerModal.tsx`)

- **New `ModalView` order:** add `"newBusiness"` as the initial view; flow becomes
  `newBusiness → attendance → callToOrder → running`.
- **New Business panel** — itemized add/remove (title + optional note), "Skip" / "Continue".
  Items held in modal state. **Persist on advance** (write the partial scaffold or a
  new-business draft) so a mid-wizard refresh doesn't lose them — the reorder front-loads data
  entry before the first persistence point, so this matters now where it didn't before.
- **Meeting date from the row, not `new Date()`** — `MeetingListClient` must pass the meeting's
  `meeting_date` into the modal (currently only `meetingId` is passed). Fixes wrong-dated
  scaffold/title for future-dated meetings and the UTC off-by-one.
- **Seed the editor from the server scaffold** — at call-to-order, take the returned HTML and
  set `editorContent` + bump `editorKey` so the `RichTextEditor` mounts with the scaffold.
- **Fix the resume bug** — when resuming an `in_progress` meeting (`initialView = "running"`),
  load the existing `minutes_content` into `editorContent` instead of `""` (today it mounts
  blank and the first `saveMeetingMinutes` overwrites the DB). Pass `minutes_content` into the
  modal from the page.

## Prep view (`/meetings/[id]`)

- For a **`pending`** meeting that is NEXT, render a **prep section** (new client-aware surface;
  the page is a Server Component today): agenda preview in standard order with board/committee
  update text inline, a submitted/not-submitted **checklist**, and the officer **reminder
  mailto buttons** — the machinery currently in `agenda/page.tsx` + `ReminderSection`, moved
  here. Include a **Start Meeting** entry point that launches the runner modal.
- **`in_progress`** → show the running/record view (not prep). **`adjourned`** → today's
  read-only record view, unchanged.
- Chairs stay redirected to their committee page (existing guard at `meetings/[id]/page.tsx`).
- The prep section reads `headers()` for the host (reminder `appUrl`) like `/agenda` does.

## Pre-meeting form (`components/hoa/PreMeetingForm.tsx`)

- Rewrite from date-navigation to **`meetingId`-based**: drop `upcomingMondays`, `selectedDate`,
  `returnPath`, and the `?date=` push/remount model. New props: `meetingId` (or null) +
  `existingContent`. No meeting → render "No meeting scheduled yet" (officers also see a
  Schedule link).
- Update all call sites: `board/[position]`, `committee/[chair]`, and the old `/pre-meeting`.
  Each computes NEXT (earliest pending meeting) server-side and passes its id.

## Cleanup / dangling references (from adversarial review)

- **`app/(dashboard)/agenda/`** — remove route; move reminder logic to the prep view.
- **`Sidebar.tsx`** — remove the `{ label: "Agenda", href: "/agenda" }` item.
- **`dashboard/page.tsx`** — repoint the "View agenda" link to the prep view (or the meeting).
- **`lib/reminder.ts`** — `buildReminderMailto` builds `…/pre-meeting?date=` — repoint to the
  prep view URL. (Already-sent emails will 404 on the old path; acceptable.)
- **`/pre-meeting`** — redirect to the prep view (officer aggregate becomes redundant).
- **`recordReminderSent`** — currently revalidates only `/agenda`; repoint to the prep view.
- Sweep for any other `/agenda` / `/pre-meeting` links or `revalidatePath` calls.

## Testing

- `buildMeetingScaffold` — pure unit tests: all-submitted, some-missing, no prior minutes,
  empty new business, quorum met/not met, name formatting.
- `createMeeting` append-only rule, `rescheduleMeeting` order-preserving rule, earliest-first
  call-to-order guard — behavior tests against the conflict logic.
- Auto-schedule-on-adjourn: refill-only (does nothing when queue non-empty), cadence fallback
  to `"3:2"`, ET date, best-effort (adjourn succeeds if schedule fails).
- Pre-meeting upsert on `(position_id, meeting_id)`.
- Follow CLAUDE.md: behavior not implementation, no snapshots, co-located.

## Out of scope (YAGNI)

- Officer pre-editing of a stored agenda draft (explicitly dropped).
- Persisting New Business as structured rows beyond the draft needed to survive a refresh — it
  lives in the scaffold HTML.
- Fully custom agenda sections / reordering the standard order.
- Realtime multi-user editing of a live meeting.
- A dedicated motions/voting UI (unchanged; secretary records via the runner).
