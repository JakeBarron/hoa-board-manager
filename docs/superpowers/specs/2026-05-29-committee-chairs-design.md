# Committee Chairs — Design Spec

**Date:** 2026-05-29
**Status:** Approved — ready for implementation planning

---

## Overview

Add five non-voting committee chair accounts to the portal. Chairs can log in, submit pre-meeting updates for their section, and view the dashboard. Voting board members can read all chair sections; president, VP, and secretary can edit them. Chairs are locked out of all other routes via per-page guards.

**Chairs:** Web, Architecture Review, Welcoming, Clubhouse, CRA

A significant side-effect: the existing `/architecture` dashboard page and primary nav item are **removed**. All architecture request management (list, vote recording, and eventually new-request submission) moves to the architecture chair's `/committee/architecture` page. The public `/architecture/[id]` detail page (outside the dashboard group, homeowner-facing) is unaffected.

---

## Permission Hierarchy

```
president → officer (VP, secretary) → member (other voting) → chair
```

| Role | Board sections | Committee sections | Admin |
|---|---|---|---|
| president | full edit | full edit | yes |
| officer | full edit | full edit | no |
| member | read-only (own: edit) | read-only | no |
| chair | no access (redirected) | own: edit, others: redirected | no |

**Render rule:** President or officer viewing a chair's page gets the identical render as the owning chair — forms are active. A member viewing a chair's page sees all widgets in read-only/disabled state. No conditional UI branching beyond edit vs. read-only.

---

## Database

### Migration `0007_committee_chairs`

1. Extend `positions.role` check constraint to include `'chair'`
2. Extend `positions.name` check constraint to include `'web'`, `'architecture'`, `'welcoming'`, `'clubhouse'`, `'cra'`
3. Insert five position rows:

```sql
INSERT INTO positions (name, email, role) VALUES
  ('web',          'web@eastspringlake.com',          'chair'),
  ('architecture', 'architecture@eastspringlake.com', 'chair'),
  ('welcoming',    'welcoming@eastspringlake.com',    'chair'),
  ('clubhouse',    'clubhouse@eastspringlake.com',    'chair'),
  ('cra',          'cra@eastspringlake.com',          'chair');
```

### `types/database.ts` changes

Chair names are added directly into the existing `PositionName` union — no separate type:

```ts
export type PositionRole = "president" | "officer" | "member" | "chair";

export type PositionName =
  | "president" | "vp" | "secretary" | "treasurer"
  | "pool" | "membership" | "tennis" | "social"
  | "web" | "architecture" | "welcoming" | "clubhouse" | "cra";
```

Every map keyed on `PositionName` (e.g. `POSITION_LABELS` in `reminder.ts` and `agenda/page.tsx`) must be updated with entries for the five new names.

### Seed (`supabase/seed.ts`)

Add five new accounts following the same pattern as the existing eight.

---

## Permissions (`lib/permissions.ts`)

Add one helper:

```ts
export const isChair = (role: PositionRole): boolean => role === "chair";
```

`canEditSection` requires no changes — a chair on their own page passes because `currentPosition === targetPosition`, identical to how a member works.

---

## Route Protection

The primary protection is the **sidebar**: chairs see only Dashboard and their own section link, so they're never presented with routes they can't use. The page-level guard is a backstop for manual URL entry only — consistent with the existing pattern where `pre-meeting/page.tsx` redirects members. No changes to `proxy.ts` or `lib/supabase/middleware.ts`.

Each page that a chair should not access redirects them to `/committee/[their-name]`. The allowed routes for a chair are:

- `/dashboard`
- `/committee/[their own name]`

All other dashboard routes (`/meetings`, `/board/*`, `/pre-meeting`, `/agenda`, `/cra`, `/admin/*`, `/committee/[other chair]`) redirect chairs. The removed `/architecture` route no longer exists to worry about.

Implementation: add a role check near the top of each page's server component, after fetching the current position. Pattern:

```ts
if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);
```

---

## Routes & Pages

### `/committee/[chair]/page.tsx`

Server component inside `app/(dashboard)/`. Inherits `DashboardLayout` (Sidebar + main layout). The Sidebar receives the position and branches based on role — chairs see a minimal nav, board members see the full nav with the Committee Chairs section.

Fetch the current user's position and the target chair position. Access logic:

- Chair viewing another chair's page → redirect to `/committee/[own name]`
- All others → render page with `canEdit` flag

**All chair pages render:**
- `PageHeader` — chair name + subtitle
- Pre-meeting update widget — reuses `PreMeetingForm` with the same date-resolution logic as `/board/[position]` (scheduled meetings → cadence fallback → Mondays fallback)
- When `canEdit` is false (member role viewing): form rendered in disabled/read-only state

**Architecture chair page additionally renders:**
- Architecture requests panel — full list of `architecture_requests` rows with `StatusBadge` per item, each linking to `/architecture/[id]` (public detail page)
- President sees the inline `VoteForm` on pending items (same as the old `/architecture` page)
- "Submit New Request" button — disabled/stubbed for now; will be built as a future widget on this page

### Chair labels & slugs

```ts
const CHAIR_LABELS: Record<ChairPositionName, string> = {
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};

// Convenience type — derived, not a new DB concept
type ChairPositionName = "web" | "architecture" | "welcoming" | "clubhouse" | "cra";
```

---

## Removed: `/architecture` Dashboard Page

The existing `app/(dashboard)/architecture/page.tsx` and `/architecture/new/page.tsx` are **deleted**. The primary nav item "Architecture" is removed from `Sidebar.tsx`.

What moves to `/committee/architecture`:
- Architecture requests list with `StatusBadge`
- `VoteForm` inline on pending items (president only)
- "Submit New Request" button (remains stubbed until the upload form is built)

What stays unchanged:
- `app/architecture/[id]/page.tsx` — public detail page, outside the dashboard group, no auth required
- `actions/architecture.ts` (`recordVote`) — still used, now called from the committee page
- RLS policies on `architecture_requests` — unchanged

---

## Sidebar (`components/hoa/Sidebar.tsx`)

**Board member view (role !== 'chair'):**

"Architecture Requests" is removed from Primary Nav. A new "Committee Chairs" section is added below "Board Sections":

```
Primary Nav
  Dashboard
  Meetings
  CRA Projects
  Pre-Meeting Update
  Agenda

Board Sections
  President … Social (unchanged)

Committee Chairs
  Web Committee          → /committee/web
  Architecture Review    → /committee/architecture
  Welcoming Committee    → /committee/welcoming
  Clubhouse Committee    → /committee/clubhouse
  CRA Committee          → /committee/cra

Admin (president only)
  Manage Positions
  Settings
```

**Chair view (role === 'chair'):**

Minimal nav — no Primary Nav, no Board Sections, no Admin:

```
Dashboard              → /dashboard
[Their section label]  → /committee/[their name]
```

The "Signed in as" footer shows the chair's position name (capitalized).

---

## Agenda Page (`app/(dashboard)/agenda/page.tsx`)

Add hardcoded `COMMITTEE_ORDER` and `COMMITTEE_LABELS` maps parallel to the existing board ones. The `pre_meeting_updates` query already fetches by `meeting_date` across all positions — no table change needed, but the query result will now include chair updates naturally.

Agenda item numbering shifts:

| # | Item |
|---|---|
| 1 | Call to Order |
| 2 | Approval of Prior Minutes |
| 3 | Board Reports (8 voting members) |
| 4 | Committee Reports (5 chairs) |
| 5 | New Business |
| 6 | Adjournment |

The hardcoded `"of 8 updates submitted"` becomes `"of 13 updates submitted"` (derived from the total position count, not a literal).

### Reminder buttons (replacing single "Send Reminder")

The "Send Reminder" section is replaced by up to three buttons, shown only to officers+, each only visible when the relevant group has missing submissions:

- **Remind Board** — mailto: to voting board members who haven't submitted (existing logic, scoped to 8 positions)
- **Remind Chairs** — mailto: to chairs who haven't submitted (links to each chair's `/committee/[name]` page, not `/pre-meeting`)
- **Remind All** — single mailto: combining both lists

`buildReminderMailto` in `lib/reminder.ts` already accepts a flat email list and a `missingPositions` array. The function is called up to three times (board-only, chairs-only, all) with the appropriate subsets. No signature change needed.

---

## Pre-Meeting Updates Page (`app/(dashboard)/pre-meeting/page.tsx`)

Add a chair redirect at the top (same pattern as other pages). The officer/president aggregate view of board updates is unaffected — the query filters by the 8 voting `PositionName` values or by role, so chair updates don't bleed in. Verify the query doesn't accidentally pick up chair position rows.

---

## What This Does NOT Include

- No dedicated meeting runner integration for chairs
- No architecture upload form (button present on chair page, form not yet built)
- No per-chair todos or minutes
- No audit log of chair account reassignments

---

## Future Work (not in this spec)

- **Architecture upload form:** Build the new-request form as a widget on `/committee/architecture`
- **Pre-meeting / Agenda merge:** Fold the Pre-Meeting Updates page into the Agenda page; agenda feeds the meeting runner
- **Chair-specific widgets:** Additional widgets per section (clubhouse booking tracker, welcoming new-resident log, etc.)
