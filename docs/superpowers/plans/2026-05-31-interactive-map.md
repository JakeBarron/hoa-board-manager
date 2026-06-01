# Interactive Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/map` stub with a clickable SVG neighborhood map + filterable property table, backed by a new `properties` Supabase table with PII-appropriate RLS.

**Architecture:** Server Component fetches all ~180 property rows once and passes them to a single `MapView` client component. `MapView` owns all state (selected lot, filters) and renders the SVG map, an info card, filter controls, and a TanStack Table. No client-side network calls after initial load.

**Tech Stack:** Next.js 16 App Router, Supabase (server client), `@tanstack/react-table`, shadcn/ui v4 (`Select`, `Input`, `Button`), Tailwind CSS v4, Jest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0012_properties.sql` | Create | DB schema + RLS policies |
| `types/database.ts` | Modify | Add `properties` table type |
| `types/domain.ts` | Modify | Add `MapFilters` type |
| `lib/map.ts` | Create | `filterProperties` pure function |
| `lib/map.test.ts` | Create | Unit tests for `filterProperties` |
| `components/ui/table.tsx` | Create | Minimal HTML table primitives with Tailwind |
| `components/hoa/NeighborhoodMap.tsx` | Create | Inline SVG with placeholder lot polygons + InfoCard |
| `components/hoa/PropertyTable.tsx` | Create | TanStack Table, 13 columns, sortable |
| `components/hoa/PropertyTable.test.tsx` | Create | RTL tests for PropertyTable |
| `components/hoa/MapView.tsx` | Create | Client component owning all state |
| `components/hoa/index.ts` | Modify | Export new components |
| `app/(dashboard)/map/page.tsx` | Modify | Server fetch + noStore + chair redirect |
| `supabase/seed.ts` | Modify | Add `seedProperties` with ~182 fake rows |

---

## Task 1: Install TanStack Table and create table primitives

**Files:**
- Create: `components/ui/table.tsx`

- [ ] **Step 1: Install the package**

```bash
cd /Users/jake/dev/hoa-board-manager && pnpm add @tanstack/react-table
```

Expected: Package added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `components/ui/table.tsx`**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

/** Scrollable wrapper + `<table>` element. */
function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

/** `<thead>` with bottom border on rows. */
function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

/** `<tbody>` — removes border from the last row. */
function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

/** `<tr>` with hover highlight. */
function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b transition-colors hover:bg-muted/50", className)}
      {...props}
    />
  );
}

/** `<th>` — sticky column header. */
function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

/** `<td>` — standard data cell. */
function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2 align-middle whitespace-nowrap", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/table.tsx package.json pnpm-lock.yaml
git commit -m "feat: install @tanstack/react-table and add table primitives"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/0012_properties.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0012_properties.sql

create table properties (
  id               uuid primary key default gen_random_uuid(),
  lot_number       integer not null unique,
  first_name       text,
  last_name        text not null,
  account_number   text,
  street_address   text,
  membership       text,
  membership_type  text,
  annual_lease_fee numeric(10,2),
  email_1          text,
  email_2          text,
  key_fob_1        text,
  key_fob_2        text,
  sayor            boolean not null default false
);

alter table properties enable row level security;

-- Voting members (president, officer, member) can read.
-- Committee chairs (role = 'chair') are excluded — they do not need resident PII.
create policy "voting member read"
  on properties for select
  to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer', 'member')
    )
  );

-- Officer+ can update rows. No UI yet — policy ready for future edit form.
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

-- No insert or delete policies.
-- Data is seeded via service role key only (supabase/seed.ts).
```

- [ ] **Step 2: Run the migration in the Supabase SQL editor (e2e project)**

Open the Supabase dashboard for the e2e project → SQL Editor → paste the file contents → Run.

Expected: `properties` table appears in Table Editor with 14 columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_properties.sql
git commit -m "feat: add properties table migration with RLS"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `types/database.ts`
- Modify: `types/domain.ts`

- [ ] **Step 1: Add `properties` table to `types/database.ts`**

Inside the `Tables` object (after the last existing table, before the closing `}`), add:

```typescript
      properties: {
        Row: {
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
        Insert: {
          id?: string;
          lot_number: number;
          first_name?: string | null;
          last_name: string;
          account_number?: string | null;
          street_address?: string | null;
          membership?: string | null;
          membership_type?: string | null;
          annual_lease_fee?: number | null;
          email_1?: string | null;
          email_2?: string | null;
          key_fob_1?: string | null;
          key_fob_2?: string | null;
          sayor?: boolean;
        };
        Update: {
          id?: string;
          lot_number?: number;
          first_name?: string | null;
          last_name?: string;
          account_number?: string | null;
          street_address?: string | null;
          membership?: string | null;
          membership_type?: string | null;
          annual_lease_fee?: number | null;
          email_1?: string | null;
          email_2?: string | null;
          key_fob_1?: string | null;
          key_fob_2?: string | null;
          sayor?: boolean;
        };
        Relationships: [];
      };
```

Then add the convenience alias at the bottom of `types/database.ts` (after the other `export type` aliases):

```typescript
export type Property = Database["public"]["Tables"]["properties"]["Row"];
```

- [ ] **Step 2: Add `MapFilters` to `types/domain.ts`**

Add at the end of the file:

```typescript
/**
 * Filter state for the interactive map property table.
 * sayor: null = show all, true = SAYOR only, false = non-SAYOR only.
 */
export type MapFilters = {
  membership: string;
  sayor: boolean | null;
  lotSearch: string;
};
```

- [ ] **Step 3: Verify**

```bash
pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts types/domain.ts
git commit -m "feat: add Property and MapFilters types"
```

---

## Task 4: filterProperties — TDD

**Files:**
- Create: `lib/map.ts`
- Create: `lib/map.test.ts`

- [ ] **Step 1: Write the failing tests in `lib/map.test.ts`**

```typescript
import { filterProperties } from "./map";
import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";

const DEFAULT_FILTERS: MapFilters = { membership: "", sayor: null, lotSearch: "" };

const make = (overrides: Partial<Property>): Property => ({
  id: "test-id",
  lot_number: 1,
  first_name: "Jane",
  last_name: "Doe",
  account_number: null,
  street_address: null,
  membership: "Mandatory",
  membership_type: "Mandatory - Recreation",
  annual_lease_fee: null,
  email_1: null,
  email_2: null,
  key_fob_1: null,
  key_fob_2: null,
  sayor: false,
  ...overrides,
});

const LOT_1 = make({ lot_number: 1, membership_type: "Mandatory - Recreation", sayor: false });
const LOT_2 = make({ lot_number: 2, membership_type: "Mandatory - Recreation", sayor: true });
const LOT_3 = make({ lot_number: 3, membership_type: "Non-Mandatory", sayor: false });
const LOT_10 = make({ lot_number: 10, membership_type: "Mandatory - Recreation", sayor: true });
const ALL = [LOT_1, LOT_2, LOT_3, LOT_10];

describe("filterProperties", () => {
  it("returns all rows when no filters are active and no lot is selected", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, null)).toEqual(ALL);
  });

  it("returns exactly the selected lot when selectedLotId is set, ignoring other filters", () => {
    const filters: MapFilters = { membership: "Non-Mandatory", sayor: true, lotSearch: "99" };
    const result = filterProperties(ALL, filters, 2);
    expect(result).toEqual([LOT_2]);
  });

  it("returns empty array when selectedLotId does not match any lot", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, 999)).toEqual([]);
  });

  it("filters by membership_type", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, membership: "Non-Mandatory" };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_3]);
  });

  it("does not filter when membership is empty string", () => {
    expect(filterProperties(ALL, DEFAULT_FILTERS, null)).toHaveLength(4);
  });

  it("filters sayor: true to only SAYOR lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: true };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_2, LOT_10]);
  });

  it("filters sayor: false to only non-SAYOR lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: false };
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_1, LOT_3]);
  });

  it("does not filter SAYOR when sayor is null", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, sayor: null };
    expect(filterProperties(ALL, filters, null)).toHaveLength(4);
  });

  it("filters by partial lot number string match", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, lotSearch: "1" };
    // Matches lot 1 and lot 10
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_1, LOT_10]);
  });

  it("returns empty array when lotSearch matches no lots", () => {
    const filters: MapFilters = { ...DEFAULT_FILTERS, lotSearch: "999" };
    expect(filterProperties(ALL, filters, null)).toEqual([]);
  });

  it("applies membership and sayor filters together (intersection)", () => {
    const filters: MapFilters = {
      membership: "Mandatory - Recreation",
      sayor: true,
      lotSearch: "",
    };
    // LOT_2 and LOT_10 are Mandatory - Recreation AND sayor: true
    expect(filterProperties(ALL, filters, null)).toEqual([LOT_2, LOT_10]);
  });
});
```

- [ ] **Step 2: Run to confirm they all fail**

```bash
pnpm test lib/map.test.ts
```

Expected: FAIL — `Cannot find module './map'`

- [ ] **Step 3: Write `lib/map.ts`**

```typescript
import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";

/**
 * Returns the subset of `lots` that match the current filter state.
 *
 * When `selectedLotId` is non-null it takes priority — returns exactly
 * the one matching lot regardless of any other filter values.
 *
 * @param lots - Full list of properties fetched server-side
 * @param filters - Active filter values from MapView state
 * @param selectedLotId - Lot number of the currently selected polygon, or null
 */
export function filterProperties(
  lots: Property[],
  filters: MapFilters,
  selectedLotId: number | null
): Property[] {
  if (selectedLotId !== null) {
    return lots.filter((l) => l.lot_number === selectedLotId);
  }
  return lots.filter((l) => {
    if (filters.membership && l.membership_type !== filters.membership) return false;
    if (filters.sayor !== null && l.sayor !== filters.sayor) return false;
    if (filters.lotSearch && !String(l.lot_number).includes(filters.lotSearch)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run to confirm all tests pass**

```bash
pnpm test lib/map.test.ts
```

Expected: PASS — 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/map.ts lib/map.test.ts
git commit -m "feat: add filterProperties with full test coverage"
```

---

## Task 5: NeighborhoodMap component

**Files:**
- Create: `components/hoa/NeighborhoodMap.tsx`

- [ ] **Step 1: Create `components/hoa/NeighborhoodMap.tsx`**

This component contains a placeholder SVG (12 rectangular lots). The real lot polygon coordinates are added in a later step once the actual neighborhood map image is provided.

```typescript
import { X } from "lucide-react";
import type { Property } from "@/types/database";

/** A single placeholder lot polygon with its label. */
interface LotShape {
  lotNumber: number;
  points: string;
  labelX: number;
  labelY: number;
}

/**
 * Placeholder lot shapes — 12 rectangles arranged in two rows of 6.
 * Replace with real traced polygon coordinates once the map image is provided.
 * Each lot's `points` is a space-separated list of "x,y" SVG polygon vertices.
 */
const PLACEHOLDER_LOTS: LotShape[] = [
  { lotNumber: 1,  points: "20,30 130,30 130,110 20,110",   labelX: 75,  labelY: 75  },
  { lotNumber: 2,  points: "140,30 250,30 250,110 140,110",  labelX: 195, labelY: 75  },
  { lotNumber: 3,  points: "260,30 370,30 370,110 260,110",  labelX: 315, labelY: 75  },
  { lotNumber: 4,  points: "380,30 490,30 490,110 380,110",  labelX: 435, labelY: 75  },
  { lotNumber: 5,  points: "500,30 610,30 610,110 500,110",  labelX: 555, labelY: 75  },
  { lotNumber: 6,  points: "620,30 730,30 730,110 620,110",  labelX: 675, labelY: 75  },
  { lotNumber: 7,  points: "20,160 130,160 130,240 20,240",  labelX: 75,  labelY: 205 },
  { lotNumber: 8,  points: "140,160 250,160 250,240 140,240",labelX: 195, labelY: 205 },
  { lotNumber: 9,  points: "260,160 370,160 370,240 260,240",labelX: 315, labelY: 205 },
  { lotNumber: 10, points: "380,160 490,160 490,240 380,240",labelX: 435, labelY: 205 },
  { lotNumber: 11, points: "500,160 610,160 610,240 500,240",labelX: 555, labelY: 205 },
  { lotNumber: 12, points: "620,160 730,160 730,240 620,240",labelX: 675, labelY: 205 },
];

interface NeighborhoodMapProps {
  /** Lot number of the currently selected polygon, or null for none. */
  selectedLotId: number | null;
  /**
   * Property data for the selected lot, used to populate the InfoCard.
   * Null when no lot is selected.
   */
  selectedLot: Property | null;
  /** Called with the lot_number when a polygon is clicked. */
  onLotClick: (lotNumber: number) => void;
  /** Called when the InfoCard dismiss button is clicked. */
  onDismiss: () => void;
}

/**
 * Interactive SVG neighborhood map with clickable lot polygons.
 * Displays an InfoCard in the top-right corner when a lot is selected.
 *
 * The polygon coordinates are currently placeholders.
 * Replace PLACEHOLDER_LOTS with real coordinates traced from the
 * actual neighborhood map image once it is provided.
 */
export function NeighborhoodMap({
  selectedLotId,
  selectedLot,
  onLotClick,
  onDismiss,
}: NeighborhoodMapProps) {
  return (
    <div className="relative w-full rounded-lg border bg-card overflow-hidden">
      <svg
        viewBox="0 0 760 270"
        className="w-full"
        aria-label="Neighborhood lot map"
        role="img"
      >
        {/* Road background */}
        <rect x="0" y="0" width="760" height="270" fill="#e5e7eb" />
        <rect x="0" y="120" width="760" height="30" fill="#d1d5db" />

        {PLACEHOLDER_LOTS.map(({ lotNumber, points, labelX, labelY }) => {
          const isSelected = lotNumber === selectedLotId;
          return (
            <g
              key={lotNumber}
              onClick={() => onLotClick(lotNumber)}
              className="cursor-pointer"
              role="button"
              aria-label={`Lot ${lotNumber}`}
              aria-pressed={isSelected}
            >
              <polygon
                points={points}
                fill={isSelected ? "#bfdbfe" : "#f9fafb"}
                stroke={isSelected ? "#3b82f6" : "#9ca3af"}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-colors hover:fill-blue-50"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill={isSelected ? "#1d4ed8" : "#374151"}
                className="select-none pointer-events-none font-medium"
              >
                {lotNumber}
              </text>
            </g>
          );
        })}
      </svg>

      {/* InfoCard — appears in top-right when a lot is selected */}
      {selectedLot && (
        <div className="absolute top-3 right-3 z-10 min-w-[180px] rounded-lg border bg-card p-3 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Lot {selectedLot.lot_number}</p>
              <p className="text-sm">{selectedLot.last_name}</p>
              <p className="text-xs text-muted-foreground">{selectedLot.membership ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{selectedLot.membership_type ?? "—"}</p>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close lot info"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/hoa/NeighborhoodMap.tsx
git commit -m "feat: add NeighborhoodMap with placeholder SVG polygons"
```

---

## Task 6: PropertyTable — TDD

**Files:**
- Create: `components/hoa/PropertyTable.test.tsx`
- Create: `components/hoa/PropertyTable.tsx`

- [ ] **Step 1: Write failing tests in `components/hoa/PropertyTable.test.tsx`**

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyTable } from "./PropertyTable";
import type { Property } from "@/types/database";

const make = (overrides: Partial<Property>): Property => ({
  id: "id-1",
  lot_number: 1,
  first_name: "Jane",
  last_name: "Doe",
  account_number: "140001",
  street_address: "123 Main St",
  membership: "Mandatory",
  membership_type: "Mandatory - Recreation",
  annual_lease_fee: null,
  email_1: "jane@example.com",
  email_2: null,
  key_fob_1: "30001",
  key_fob_2: "30002",
  sayor: false,
  ...overrides,
});

const LOT_5 = make({ id: "id-5", lot_number: 5, last_name: "Smith" });
const LOT_12 = make({ id: "id-12", lot_number: 12, last_name: "Garcia" });

describe("PropertyTable", () => {
  it("renders a row for each lot passed in", () => {
    render(<PropertyTable lots={[LOT_5, LOT_12]} onLotClick={() => {}} />);
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
  });

  it("calls onLotClick with the correct lot_number when lot # button is clicked", async () => {
    const user = userEvent.setup();
    const onLotClick = jest.fn();
    render(<PropertyTable lots={[LOT_5, LOT_12]} onLotClick={onLotClick} />);
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(onLotClick).toHaveBeenCalledWith(5);
    expect(onLotClick).toHaveBeenCalledTimes(1);
  });

  it("renders null fields as an em dash", () => {
    const lot = make({ email_1: null, key_fob_1: null, annual_lease_fee: null });
    render(<PropertyTable lots={[lot]} onLotClick={() => {}} />);
    // Multiple — cells expected for null fields
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders SAYOR as 'Yes' or 'No'", () => {
    const sayorLot = make({ sayor: true });
    const nonSayorLot = make({ lot_number: 2, sayor: false });
    render(<PropertyTable lots={[sayorLot, nonSayorLot]} onLotClick={() => {}} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders an empty table body when no lots are provided", () => {
    render(<PropertyTable lots={[]} onLotClick={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test components/hoa/PropertyTable.test.tsx
```

Expected: FAIL — `Cannot find module './PropertyTable'`

- [ ] **Step 3: Create `components/hoa/PropertyTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Property } from "@/types/database";

const col = createColumnHelper<Property>();

const buildColumns = (onLotClick: (lotNumber: number) => void) => [
  col.accessor("lot_number", {
    header: "Lot #",
    cell: (info) => (
      <button
        className="font-medium underline-offset-2 hover:underline text-foreground"
        onClick={() => onLotClick(info.getValue())}
        aria-label={String(info.getValue())}
      >
        {info.getValue()}
      </button>
    ),
  }),
  col.accessor("last_name", {
    header: "Last Name",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("first_name", {
    header: "First Name",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("street_address", {
    header: "Street Address",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("membership_type", {
    header: "Membership Type",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("annual_lease_fee", {
    header: "Annual Lease Fee",
    cell: (info) => {
      const v = info.getValue();
      return v != null ? `$${v.toFixed(2)}` : "—";
    },
  }),
  col.accessor("sayor", {
    header: "SAYOR",
    cell: (info) => (info.getValue() ? "Yes" : "No"),
  }),
  col.accessor("key_fob_1", {
    header: "Key Fob 1",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("key_fob_2", {
    header: "Key Fob 2",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("email_1", {
    header: "Email 1",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("email_2", {
    header: "Email 2",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("account_number", {
    header: "Account #",
    cell: (info) => info.getValue() ?? "—",
  }),
];

interface PropertyTableProps {
  /** Pre-filtered list of properties to display. */
  lots: Property[];
  /** Called with the lot_number when the lot # cell button is clicked. */
  onLotClick: (lotNumber: number) => void;
}

/**
 * Sortable property table using TanStack Table.
 * Receives a pre-filtered `lots` array — all filtering is done upstream in MapView.
 * Default sort is lot_number ascending (matches server fetch order).
 */
export function PropertyTable({ lots, onLotClick }: PropertyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lot_number", desc: false },
  ]);

  const table = useReactTable({
    data: lots,
    columns: buildColumns(onLotClick),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === "asc" && " ↑"}
                {header.column.getIsSorted() === "desc" && " ↓"}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test components/hoa/PropertyTable.test.tsx
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/hoa/PropertyTable.tsx components/hoa/PropertyTable.test.tsx
git commit -m "feat: add PropertyTable with TanStack Table and tests"
```

---

## Task 7: MapView component

**Files:**
- Create: `components/hoa/MapView.tsx`

- [ ] **Step 1: Create `components/hoa/MapView.tsx`**

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";
import { filterProperties } from "@/lib/map";
import { NeighborhoodMap } from "./NeighborhoodMap";
import { PropertyTable } from "./PropertyTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const DEFAULT_FILTERS: MapFilters = { membership: "", sayor: null, lotSearch: "" };

/** Maps the SAYOR filter boolean|null to a string value for the Select component. */
function sayorToString(sayor: boolean | null): string {
  if (sayor === null) return "all";
  return sayor ? "true" : "false";
}

/** Maps a Select string value back to boolean|null for filter state. */
function stringToSayor(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

interface MapViewProps {
  /** Full list of properties fetched server-side, ordered by lot_number. */
  lots: Property[];
}

/**
 * Interactive map + property table with shared filter state.
 * Owns all interaction state: selected lot, membership filter, SAYOR filter, lot# search.
 * Clicking a map polygon or a table Lot # cell toggles the selected lot,
 * which filters the table to show only that row.
 */
export function MapView({ lots }: MapViewProps) {
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);

  const handleLotClick = useCallback((lotNumber: number) => {
    setSelectedLotId((prev) => (prev === lotNumber ? null : lotNumber));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedLotId(null);
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilter =
    selectedLotId !== null ||
    filters.membership !== "" ||
    filters.sayor !== null ||
    filters.lotSearch !== "";

  const filteredLots = useMemo(
    () => filterProperties(lots, filters, selectedLotId),
    [lots, filters, selectedLotId]
  );

  const selectedLot = useMemo(
    () => (selectedLotId !== null ? (lots.find((l) => l.lot_number === selectedLotId) ?? null) : null),
    [lots, selectedLotId]
  );

  /** Distinct membership_type values derived from the full dataset, for the dropdown. */
  const membershipTypes = useMemo(
    () =>
      Array.from(new Set(lots.map((l) => l.membership_type).filter(Boolean))).sort() as string[],
    [lots]
  );

  return (
    <div className="space-y-4">
      <NeighborhoodMap
        selectedLotId={selectedLotId}
        selectedLot={selectedLot}
        onLotClick={handleLotClick}
        onDismiss={handleReset}
      />

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.membership === "" ? "all" : filters.membership}
          onValueChange={(v: string) =>
            setFilters((f) => ({ ...f, membership: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All membership types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All membership types</SelectItem>
            {membershipTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sayorToString(filters.sayor)}
          onValueChange={(v: string) =>
            setFilters((f) => ({ ...f, sayor: stringToSayor(v) }))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="SAYOR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">SAYOR</SelectItem>
            <SelectItem value="false">Non-SAYOR</SelectItem>
          </SelectContent>
        </Select>

        <Input
          className="w-32"
          placeholder="Lot #"
          value={filters.lotSearch}
          onChange={(e) =>
            setFilters((f) => ({ ...f, lotSearch: e.target.value }))
          }
          aria-label="Search by lot number"
        />

        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasActiveFilter}
        >
          Show All
        </Button>
      </div>

      <PropertyTable lots={filteredLots} onLotClick={handleLotClick} />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/hoa/MapView.tsx
git commit -m "feat: add MapView with shared state, filters, and filter controls"
```

---

## Task 8: Update page and exports

**Files:**
- Modify: `app/(dashboard)/map/page.tsx`
- Modify: `components/hoa/index.ts`

- [ ] **Step 1: Replace the map page stub**

Replace the entire contents of `app/(dashboard)/map/page.tsx`:

```typescript
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { MapView } from "@/components/hoa/MapView";

export const metadata = {
  title: "Interactive Map — HOA Board",
};

/**
 * Neighborhood lot map page.
 * Fetches all properties server-side and passes them to MapView for client-side interaction.
 * Restricted to voting members (president, officer, member). Chairs are redirected.
 * noStore() prevents Next.js from caching this response across sessions.
 */
export default async function MapPage() {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();

  if (!positionResult.data) redirect("/login");
  if (isChair(positionResult.data.role)) redirect("/dashboard");

  const propertiesResult = await supabase
    .from("properties")
    .select(
      "id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor"
    )
    .order("lot_number");

  const lots = propertiesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Map"
        subtitle="Neighborhood lots and property information"
      />
      <MapView lots={lots} />
    </div>
  );
}
```

- [ ] **Step 2: Update `components/hoa/index.ts`**

Add these three exports at the end of the file:

```typescript
export { MapView } from "./MapView";
export { NeighborhoodMap } from "./NeighborhoodMap";
export { PropertyTable } from "./PropertyTable";
```

- [ ] **Step 3: Verify and run full test suite**

```bash
pnpm type-check && pnpm test --ci
```

Expected: Type check passes, all tests pass (the 180 existing tests plus the new ones).

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/map/page.tsx components/hoa/index.ts
git commit -m "feat: wire map page — server fetch, chair guard, render MapView"
```

---

## Task 9: Seed fake property data

**Files:**
- Modify: `supabase/seed.ts`

- [ ] **Step 1: Add `seedProperties` to `supabase/seed.ts`**

Add the following before the `main()` function:

```typescript
const FAKE_STREETS = [
  "Long Lake Drive",
  "Camp Point Court",
  "Spring Rock Court",
  "Stonebrook Court",
  "Lakeside Lane",
  "Crystal Ridge Way",
];

const FAKE_FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer",
  "Michael", "Linda", "William", "Barbara", "David", "Elizabeth",
  "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah",
  "Charles", "Karen",
];

const FAKE_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
  "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas",
  "Jackson", "White", "Harris", "Martin", "Thompson", "Moore",
  "Young", "Allen", "King", "Wright", "Scott", "Green",
];

/** Lot numbers 1–193 with 11 gaps for realism (~182 lots). */
const SKIPPED_LOTS = new Set([15, 32, 47, 78, 99, 121, 145, 167, 181, 188, 192]);
const LOT_NUMBERS = Array.from({ length: 193 }, (_, i) => i + 1).filter(
  (n) => !SKIPPED_LOTS.has(n)
);

/**
 * Builds ~182 deterministic fake property rows for the e2e Supabase project.
 * Uses modular arithmetic so results are reproducible across runs.
 */
function buildFakeProperties() {
  return LOT_NUMBERS.map((lotNumber, i) => ({
    lot_number: lotNumber,
    first_name: FAKE_FIRST_NAMES[i % FAKE_FIRST_NAMES.length],
    last_name: FAKE_LAST_NAMES[i % FAKE_LAST_NAMES.length],
    account_number: `14${String(1000 + i).padStart(4, "0")}`,
    street_address: `${2600 + i} ${FAKE_STREETS[i % FAKE_STREETS.length]}`,
    membership: i % 12 === 0 ? "Non-Mandatory" : "Mandatory",
    membership_type: i % 12 === 0 ? "Non-Mandatory" : "Mandatory - Recreation",
    annual_lease_fee: i % 18 === 0 ? 150.0 : null,
    email_1: i % 6 !== 0 ? `resident.${lotNumber}@example.com` : null,
    email_2: i % 12 === 1 ? `resident.${lotNumber}.alt@example.com` : null,
    key_fob_1: i % 8 !== 0 ? String(30000 + i * 2) : null,
    key_fob_2: i % 8 !== 0 ? String(30001 + i * 2) : null,
    sayor: i % 7 === 0,
  }));
}

/**
 * Upserts ~182 fake property rows into the e2e `properties` table.
 * Safe to re-run — uses upsert on lot_number.
 */
async function seedProperties(): Promise<void> {
  console.log("\nSeeding properties…");
  const properties = buildFakeProperties();
  const { error } = await supabase
    .from("properties")
    .upsert(properties, { onConflict: "lot_number" });

  if (error) throw new Error(`Failed to seed properties: ${error.message}`);
  console.log(`  ✓ Upserted ${properties.length} property rows`);
}
```

- [ ] **Step 2: Call `seedProperties` from `main()`**

In the existing `main()` function, add `await seedProperties();` after the positions loop:

```typescript
async function main() {
  console.log("Seeding board positions…\n");

  for (const pos of positions) {
    await seedPosition(pos);
  }

  await seedProperties();

  console.log("\nDone. Remember to update emails and passwords before sharing.");
}
```

- [ ] **Step 3: Run the seed against the e2e project**

```bash
pnpm seed
```

Expected output includes:
```
Seeding properties…
  ✓ Upserted 182 property rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.ts
git commit -m "feat: seed ~182 fake property rows for e2e testing"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full type-check and test suite**

```bash
pnpm type-check && pnpm test --ci
```

Expected: No type errors. All tests pass.

- [ ] **Step 2: Start the dev server and verify the page works**

```bash
pnpm dev
```

Open `http://localhost:3000/map` (logged in as a voting member, e.g. treasurer).

Verify:
- Page loads with the SVG map and table below
- Clicking a placeholder lot polygon (numbered 1–12) highlights it and filters the table to that one row
- The InfoCard appears in the top-right of the map with Lot #, Last Name, Membership, Membership Type
- Clicking the X on the InfoCard resets everything
- Clicking the same polygon again toggles it off
- Clicking a Lot # cell in the table highlights the corresponding polygon
- The membership type dropdown filters the table
- The SAYOR select (All / SAYOR / Non-SAYOR) filters correctly
- The Lot # search input filters by partial match
- "Show All" is disabled when no filters are active; enabled and working when filters are set

- [ ] **Step 3: Verify chair redirect**

Log in as a committee chair (e.g. `web@yourhoa.com`). Navigate to `/map`. Confirm you are redirected to `/dashboard`.

- [ ] **Step 4: Final commit if anything was fixed in verification**

```bash
git add -p
git commit -m "fix: <description of any fixes found during verification>"
```

---

## Deferred: Real map polygon coordinates

When the actual neighborhood map image is provided:

1. Open the image in an SVG tracing tool or reference it as a background
2. For each lot, record the polygon vertex coordinates in SVG coordinate space
3. Replace the `PLACEHOLDER_LOTS` array in `components/hoa/NeighborhoodMap.tsx` with the real lot shapes
4. Set the `viewBox` on the `<svg>` element to match the coordinate space of the traced polygons
5. Remove the road background rectangles (the real map provides visual context)
6. Test that all ~180 polygon click interactions work correctly
7. Commit: `feat: replace placeholder SVG polygons with real neighborhood map coordinates`
