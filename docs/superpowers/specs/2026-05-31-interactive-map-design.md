# Interactive Map — Design Spec

**Date:** 2026-05-31
**Status:** Approved — pending implementation plan
**Feature:** `/map` — clickable neighborhood lot map + property data table

---

## Overview

Replace the `/map` stub with a fully interactive neighborhood map. Each lot is a clickable SVG polygon. Clicking a lot shows a summary card and filters the property table below to that lot's row. The table also drives the map — clicking a lot number in the table highlights the corresponding polygon. All ~180 property rows are fetched once server-side and handled entirely client-side thereafter.

---

## Architecture & Data Flow

`/map/page.tsx` is a Server Component. It fetches all rows from the `properties` table (ordered by `lot_number`) using the Supabase server client and passes them as a prop to `MapView`.

`MapView` is a single `"use client"` component that owns all interactive state. It renders the SVG map, the info card, the filter controls, and the property table. No client-side network calls occur after the initial server fetch.

```
app/(dashboard)/map/page.tsx          ← Server Component, fetches Property[]
  └─ MapView (client)
       ├─ NeighborhoodMap             ← inline SVG, lot polygons, info card
       ├─ TableControls               ← membership filter, SAYOR toggle, lot# search, reset
       └─ PropertyTable               ← TanStack Table, 13 columns
```

---

## Database

**Migration:** `0012_properties.sql`

```sql
create table properties (
  id               uuid primary key default gen_random_uuid(),
  lot_number       integer not null unique,
  first_name       text,
  last_name        text not null,
  account_number   text,
  street_address   text,
  membership       text,         -- e.g. 'Mandatory', 'Non-Mandatory'
  membership_type  text,         -- e.g. 'Mandatory - Recreation'
  annual_lease_fee numeric(10,2),
  email_1          text,
  email_2          text,
  key_fob_1        text,
  key_fob_2        text,
  sayor            boolean not null default false
);

alter table properties enable row level security;

-- Board members only can read (president, officer, member — not committee chairs)
-- Chairs do not need access to resident PII (emails, addresses, key fobs)
create policy "board member read"
  on properties for select
  to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer', 'member')
    )
  );

-- Officer+ can update (no UI yet — policy ready for future edit form)
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

-- No insert/delete policies — data managed via service role seed only
-- Service role bypasses RLS by design; it must never be used in app code
```

`lot_number` is the join key between SVG polygons and property rows. No `created_at` — this data originates from an external aging report and timestamps are meaningless.

---

## Permissions

Board members (president, officer, member) can access this page. Committee chairs are redirected to `/dashboard` — they do not need access to resident PII.

The page adds a server-side redirect guard consistent with other restricted pages:
```typescript
if (isChair(role)) redirect('/dashboard');
```

This is defense-in-depth: the RLS policy already blocks chair JWTs at the database level. The server redirect prevents chairs from ever seeing the page or receiving the property payload.

Future update UI will be officer/president only (enforced by the RLS policy above).

---

## Security & PII Protection

This table contains resident PII: full names, street addresses, email addresses, and key fob numbers. The following controls are in place:

### RLS as the primary enforcement layer
The `board member read` policy means a committee chair's JWT returns zero rows even if they call the Supabase API directly. The `officer update` policy ensures no board member below officer rank can modify records via direct API calls either. No insert or delete policies exist — the only write path is the service role seed script.

### Server-side redirect guard (defense-in-depth)
The `/map` page redirects chairs before any data is fetched. Even if the RLS policy were misconfigured, chairs would never receive a payload.

### Client payload — explicit tradeoff
The "fetch all 180 rows, filter client-side" architecture serializes the full property dataset into the page's HTML hydration payload. Any logged-in board member with DevTools can read the raw data. This is an accepted tradeoff for an internal portal with 8 trusted board members — it avoids per-interaction network calls and keeps the UX fast. If the user base or sensitivity level changes, the architecture should be revisited (e.g. server-side filtering with paginated fetches).

### Explicit column selection
The server fetch uses an explicit column list rather than `select('*')`:
```typescript
supabase
  .from('properties')
  .select('id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor')
  .order('lot_number')
```
This prevents future column additions (e.g. phone numbers) from being silently included in the payload.

### No caching
The page calls `noStore()` from `next/cache` to prevent Next.js from caching the response. A cached response could serve one authenticated user's data to a different session.

### No client-side persistence
Property data lives only in React component state (in-memory). It is never written to `localStorage`, `sessionStorage`, or the URL. The dataset clears when the tab closes.

### Service role isolation
The seed script uses the Supabase service role key, which bypasses RLS by design. The service role key must never appear in app code (`lib/supabase/client.ts` or `lib/supabase/server.ts`). It is only used in `supabase/seed.ts` run locally via `pnpm seed`.

---

## State Management

```typescript
// selectedLotId is separate — it drives both the map highlight AND the table filter
const [selectedLotId, setSelectedLotId] = useState<number | null>(null);

// Table filters are grouped — they reset together and are conceptually a unit
const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);

const DEFAULT_FILTERS: MapFilters = { membership: '', sayor: null, lotSearch: '' };
```

`handleLotClick(lotNumber: number)` — called by both map polygon clicks and table lot# cell clicks. Toggles: if `selectedLotId === lotNumber`, clears it; otherwise sets it. Clears `filters.lotSearch` when a lot is selected from the map (the selected lot is the filter).

`handleReset()` — sets `selectedLotId` to `null` and `filters` to `DEFAULT_FILTERS`.

---

## Components

### NeighborhoodMap

Renders an inline `<svg>` with one `<polygon>` (or `<path>`) per lot. Each polygon has a `data-lot` attribute matching `lot_number`.

- **Default state:** neutral fill, subtle stroke
- **Selected lot:** distinct highlight fill (blue tint)
- **Hover:** cursor pointer, slight fill shift via CSS

An `InfoCard` is absolutely positioned in the top-right corner of the SVG container. It appears when `selectedLotId` is non-null. Shows: Lot #, Last Name, Membership, Membership Type, and an X button to dismiss (calls `handleReset`).

The actual lot polygon coordinates are a placeholder for now (a handful of labeled rectangles). The real coordinates are traced from the neighborhood map image in a dedicated implementation step after the user provides the image.

### PropertyTable

TanStack Table (React Table v8) rendered with the existing shadcn/ui `Table` primitive.

**Column order:** Lot #, Last Name, First Name, Street Address, Membership Type, Annual Lease Fee, SAYOR, Key Fob 1, Key Fob 2, Email 1, Email 2, Account #

**Lot # cell** is rendered as a clickable button that calls `handleLotClick`. Styled to look interactive (underline or muted link color).

**Filtering:** A pure function `filterProperties(lots, filters, selectedLotId)` computes the displayed rows on every render. When `selectedLotId` is set, it returns exactly one row (the selected lot) regardless of other filters. When `selectedLotId` is null, it applies `membership`, `sayor`, and `lotSearch` filters from the `filters` object.

**Default sort:** `lot_number` ascending.

**No pagination** — 180 rows renders comfortably in a scrollable table.

### TableControls

Sits between the map and table. Contains:
- Membership Type dropdown (derived from distinct values in the loaded data)
- SAYOR select with three options: "All", "SAYOR", "Non-SAYOR" (maps to `null`, `true`, `false`)
- Lot # search input (string match on `lot_number`)
- "Show All" button — disabled when `selectedLotId` is null and all filters are default

---

## Types

Added to `types/domain.ts`:

```typescript
export type Property = {
  id: string;
  lot_number: number;
  first_name: string | null;
  last_name: string;
  account_number: string | null;
  street_address: string | null;
  membership: string | null;
  membership_type: string | null;
  annual_lease_fee: number | null;
  email_1: string | null;
  email_2: string | null;
  key_fob_1: string | null;
  key_fob_2: string | null;
  sayor: boolean;
};

export type MapFilters = {
  membership: string;
  sayor: boolean | null; // null = show all, true = SAYOR only, false = non-SAYOR only
  lotSearch: string;
};
```

Added to `types/database.ts`: `properties` table type with `Relationships: []`.

---

## Filter Logic

Extracted as a pure function in `lib/map.ts`:

```typescript
function filterProperties(
  lots: Property[],
  filters: MapFilters,
  selectedLotId: number | null
): Property[] {
  if (selectedLotId !== null) {
    return lots.filter(l => l.lot_number === selectedLotId);
  }
  return lots.filter(l => {
    if (filters.membership && l.membership_type !== filters.membership) return false;
    if (filters.sayor !== null && l.sayor !== filters.sayor) return false;
    if (filters.lotSearch && !String(l.lot_number).includes(filters.lotSearch)) return false;
    return true;
  });
}
```

---

## Testing

`filterProperties` is unit-tested in `lib/map.test.ts`. Cases:
- No filters → all rows returned
- `selectedLotId` set → exactly one row, other filters ignored
- Membership filter → only matching rows
- SAYOR `null` → all rows returned
- SAYOR `true` → only `sayor: true` rows
- SAYOR `false` → only `sayor: false` rows
- Lot# search → partial string match
- Combined filters (membership + SAYOR) → intersection

`PropertyTable` gets a light RTL test: given a pre-filtered array, correct rows render and clicking a Lot # cell calls `onLotClick` with the right value.

---

## E2E Seed Data

~180 fake property rows added to `supabase/seed.ts` via upsert on `lot_number` (idempotent). Lot numbers run roughly 1–193 with realistic gaps. Fake names, a small set of fake street names, a mix of membership types, randomized `sayor` values, and some null email/fob fields to exercise null handling in the table.

---

## File List

| File | Change |
|---|---|
| `supabase/migrations/0012_properties.sql` | New — properties table + RLS |
| `types/database.ts` | Add properties table type |
| `types/domain.ts` | Add `Property`, `MapFilters` |
| `app/(dashboard)/map/page.tsx` | Replace stub — server fetch + noStore() + chair redirect + render MapView |
| `components/hoa/MapView.tsx` | New — client component, owns all state |
| `components/hoa/NeighborhoodMap.tsx` | New — inline SVG with placeholder polygons |
| `components/hoa/PropertyTable.tsx` | New — TanStack Table, 13 columns |
| `components/hoa/index.ts` | Export new components |
| `lib/map.ts` | New — `filterProperties` pure function |
| `lib/map.test.ts` | New — unit tests for `filterProperties` |
| `supabase/seed.ts` | Add ~180 fake property rows |

---

## Out of Scope (First Pass)

- Property edit form (RLS update policy is ready; no UI yet)
- Color-coding lots by membership type or balance status
- Hover tooltips (click-only interaction)
- Lot # 2025/2026 financial columns (excluded from first pass)
- Billing/other comments, household name, Email 3 (excluded from first pass)
