# Committee Chairs — Design Spec

**Date:** 2026-05-29
**Status:** Approved — ready for implementation planning

---

## Overview

Add five non-voting committee chair accounts to the portal. Chairs can log in, submit pre-meeting updates for their section, and view the dashboard. Voting board members can read all chair sections; president, VP, and secretary can edit them. Chairs are locked out of all other routes.

**Chairs:** Web, Architecture Review, Welcoming, Clubhouse, CRA

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

```ts
export type PositionRole = "president" | "officer" | "member" | "chair";

export type PositionName =
  | "president" | "vp" | "secretary" | "treasurer"
  | "pool" | "membership" | "tennis" | "social"
  | "web" | "architecture" | "welcoming" | "clubhouse" | "cra";
```

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

## Route Protection (`proxy.ts` / middleware)

Chairs are redirected to `/committee/[their-name]` if they attempt to access any route outside of:

- `/dashboard`
- `/committee/[their own name]`

All other routes (`/meetings`, `/architecture`, `/board/*`, `/pre-meeting`, `/agenda`, `/cra`, `/admin/*`, `/committee/[other chair]`) respond with a redirect. This is enforced in `lib/supabase/middleware.ts` alongside the existing auth redirect logic.

---

## Routes & Pages

### `/committee/[chair]/page.tsx`

Server component. Fetches the current user's position and the target chair position. Access logic:

- Chair viewing another chair's page → redirect to `/committee/[own name]`
- All others → render page with appropriate edit flag

**All chair pages render:**
- `PageHeader` — chair name + subtitle
- Pre-meeting update widget — reuses `PreMeetingForm` with the same date-resolution logic as `/board/[position]` (scheduled meetings → cadence fallback → Mondays fallback)

**Architecture chair page additionally renders:**
- Architecture requests panel — list of `architecture_requests` rows with `StatusBadge` per item, each linking to `/architecture/[id]`
- "Submit New Request" button linking to `/architecture/new` (currently stubbed — button present, form not yet built)

### Chair labels & slugs

```ts
const CHAIR_LABELS: Record<ChairName, string> = {
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};
```

`ChairName` is a derived type: the five new `PositionName` values. Can be expressed as a type alias for clarity without adding a new concept to the DB.

---

## Sidebar (`components/hoa/Sidebar.tsx`)

**Board member view (role !== 'chair'):**

Existing sections unchanged. Add a new "Committee Chairs" section below "Board Sections":

```
Committee Chairs
  Web Committee          → /committee/web
  Architecture Review    → /committee/architecture
  Welcoming Committee    → /committee/welcoming
  Clubhouse Committee    → /committee/clubhouse
  CRA Committee          → /committee/cra
```

**Chair view (role === 'chair'):**

Minimal nav — no Primary Nav, no Board Sections, no Admin:

```
Dashboard              → /dashboard
[Their section label]  → /committee/[their name]
```

The "Signed in as" footer label still shows their position name.

---

## Agenda Page (`app/(dashboard)/agenda/page.tsx`)

Add a hardcoded `COMMITTEE_ORDER` and `COMMITTEE_LABELS` map parallel to the existing board ones. Fetch pre-meeting updates for all 13 positions (8 board + 5 chairs) in the existing `pre_meeting_updates` query — no table change needed.

Agenda item numbering shifts:

| # | Item |
|---|---|
| 1 | Call to Order |
| 2 | Approval of Prior Minutes |
| 3 | Board Reports (8 voting members) |
| 4 | Committee Reports (5 chairs) |
| 5 | New Business |
| 6 | Adjournment |

The missing-submissions count, the "X of 13 updates submitted" label, and the `buildReminderMailto` call all expand to include all 13 positions. `buildReminderMailto` already accepts a flat email list — pass all 13 emails, no signature change needed.

---

## Pre-Meeting Updates Page (`app/(dashboard)/pre-meeting/page.tsx`)

Chairs are redirected away from this route (covered by middleware). No other changes needed — the aggregate officer/president view of board updates is unaffected. Committee updates are surfaced on the Agenda page instead.

---

## What This Does NOT Include

- No dedicated meeting runner integration for chairs (read-only presence, future scope)
- No architecture upload form (remains stubbed at `/architecture/new`)
- No per-chair todos or minutes (pre-meeting update is the only widget for non-architecture chairs at launch)
- No audit log of chair account reassignments

---

## Future Work (not in this spec)

- **Pre-meeting / Agenda merge:** Fold the Pre-Meeting Updates page into the Agenda page so officers can browse updates and generate an agenda that feeds directly into the meeting runner. (See `docs/specs/README.md`)
- **Chair-specific widgets:** Additional widgets per section beyond the pre-meeting update (e.g. clubhouse booking tracker, welcoming new-resident log)
- **Architecture upload form:** Build `/architecture/new` so the architecture chair can submit requests with file attachments
