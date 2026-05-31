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

-- All authenticated users (board + chairs) can read
create policy "authenticated read"
  on properties for select
  to authenticated using (true);

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
```

`lot_number` is the join key between SVG polygons and property rows. No `created_at` — this data originates from an external aging report and timestamps are meaningless.

---

## Permissions

This page is visible to all 13 authenticated positions (board members + committee chairs). No redirect guard needed — the data is read-only and relevant to everyone. The sidebar already shows the Map link to all roles.

Future update UI will be officer/president only (enforced by the RLS policy above).

---

## State Management

```typescript
// selectedLotId is separate — it drives both the map highlight AND the table filter
const [selectedLotId, setSelectedLotId] = useState<number | null>(null);

// Table filters are grouped — they reset together and are conceptually a unit
const [filters, setFilters] = useState<MapFilters>({
  membership: '',
  sayor: false,
  lotSearch: '',
});

const DEFAULT_FILTERS: MapFilters = { membership: '', sayor: false, lotSearch: '' };
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
- SAYOR toggle (checkbox or switch)
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
  sayor: boolean;
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
    if (filters.sayor && !l.sayor) return false;
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
- SAYOR filter → only `sayor: true` rows
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
| `app/(dashboard)/map/page.tsx` | Replace stub — server fetch + render MapView |
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
