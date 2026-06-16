# Operating Calendar (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a board-wide, read-by-everyone operating calendar — the recurring annual cycle of running the HOA (all responsibility areas), surfaced as a month-grouped read view + a dashboard widget, with president/officer admin CRUD.

**Architecture:** Three new Postgres tables (`responsibility_areas`, `calendar_events`, `event_occurrences`) with `0018`-style RLS/grants. Pages fetch the three tables as separate queries and join them in JS via a pure, tested helper module (no PostgREST embeds — the typed client has `Relationships: []`, so embeds don't type-infer). All date math is plain `Date` arithmetic on month integers; `date-fns` is deliberately NOT introduced in v1 (it lands with the month-grid fast-follow).

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres + RLS) · Tailwind v4 + shadcn/ui v4 (`@base-ui/react`) · Jest + React Testing Library.

**Source of truth:** `docs/specs/operating-calendar.md` (read it first — the seed data table lives there).

---

## Parallelization (for the dispatcher)

```
Task 1 ─┐
Task 2 ─┼─ FOUNDATION (sequential, one agent — shared contract)
Task 3 ─┘
            │
            ├─ Task 4 (actions) ──► Task 6 (admin CRUD UI)     ◄ track A
            ├─ Task 5 (read page + filter + nav)               ◄ track B (parallel)
            └─ Task 7 (dashboard widget)                       ◄ track C (parallel)
```

Tasks 1→3 MUST complete and merge first — they are the shared interface (`CalendarItem`, the helpers, the DB types). Then tracks A/B/C run in parallel. Within track A, Task 4 (actions) precedes Task 6 (the CRUD UI that calls them).

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0019_operating_calendar.sql` | 3 tables + RLS + grants + `is_calendar_editor()` + seed |
| `types/database.ts` (modify) | 3 table types (`Relationships: []`) + convenience row types |
| `lib/calendar/calendar.ts` | Pure helpers + `CalendarItem` flat type + `buildCalendarItems` |
| `lib/calendar/calendar.test.ts` | Co-located behavior tests |
| `actions/calendar.ts` | `saveArea` / `deleteArea` / `saveEvent` / `deleteEvent` (canEditAll) |
| `app/(dashboard)/calendar/page.tsx` | Month-grouped read view (everyone) |
| `components/hoa/CalendarView.tsx` | Client: area filter + legend + month sections |
| `components/hoa/CalendarView.test.tsx` | Filter behavior test |
| `app/(dashboard)/calendar/manage/page.tsx` | Admin CRUD page (canEditAll gate) |
| `components/hoa/CalendarAdmin.tsx` | Client: area + event editors calling the actions |
| `components/hoa/UpcomingCalendarWidget.tsx` | Client: top-5 upcoming, used on dashboard |
| `app/(dashboard)/dashboard/page.tsx` (modify) | Mount the widget |
| `components/hoa/Sidebar.tsx` (modify) | Add "Calendar" nav (board + chair views) |
| `components/hoa/index.ts` (modify) | Barrel exports for new components |

---

## Task 1: Migration `0019` — tables, RLS, grants, seed

**Files:**
- Create: `supabase/migrations/0019_operating_calendar.sql`

**Context:** Copy the RLS/grant style from `supabase/migrations/0018_treasury_schema.sql` (a `security definer` helper + per-table read/write policies + a final `grant all`). Migrations are hand-run in the Supabase SQL editor in order; there is no CLI. The seed DATA comes from the seed table in `docs/specs/operating-calendar.md` — transcribe it, do not invent values.

- [ ] **Step 1: Write the schema + RLS + grants**

```sql
-- supabase/migrations/0019_operating_calendar.sql

create table responsibility_areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null,                 -- hex string, e.g. '#0f766e'
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table calendar_events (
  id                     uuid primary key default gen_random_uuid(),
  area_id                uuid not null references responsibility_areas(id) on delete restrict,
  title                  text not null unique,
  responsible_party      text,
  notes                  text,
  template_url           text,
  created_by_position_id uuid references positions(id),
  created_at             timestamptz not null default now(),
  updated_by_position_id uuid references positions(id),
  updated_at             timestamptz not null default now()
);

create table event_occurrences (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references calendar_events(id) on delete cascade,
  month         integer not null check (month between 1 and 12),
  day_of_month  integer check (day_of_month between 1 and 31),
  unique (event_id, month)
);

-- Enable RLS
alter table responsibility_areas enable row level security;
alter table calendar_events enable row level security;
alter table event_occurrences enable row level security;

-- Helper: true if the current user is president or officer (canEditAll)
create or replace function is_calendar_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
    and role in ('president', 'officer')
  );
$$;

-- responsibility_areas: all authenticated read; editors write
create policy "ra_read" on responsibility_areas for select to authenticated using (true);
create policy "ra_write" on responsibility_areas for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- calendar_events
create policy "ce_read" on calendar_events for select to authenticated using (true);
create policy "ce_write" on calendar_events for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- event_occurrences
create policy "eo_read" on event_occurrences for select to authenticated using (true);
create policy "eo_write" on event_occurrences for all to authenticated
  using (is_calendar_editor()) with check (is_calendar_editor());

-- Grants (required for tables created after the initial "grant all" snapshot)
grant all on responsibility_areas to anon, authenticated, service_role;
grant all on calendar_events to anon, authenticated, service_role;
grant all on event_occurrences to anon, authenticated, service_role;
```

- [ ] **Step 2: Append the seed — areas first**

```sql
-- ── Seed: responsibility areas (hex colors) ──────────────────────────────
insert into responsibility_areas (name, color, sort_order) values
  ('Clubhouse',  '#b45309', 1),
  ('Membership', '#7c3aed', 2),
  ('Homeside',   '#0f766e', 3),
  ('Treasurer',  '#15803d', 4),
  ('Board',      '#1d4ed8', 5),
  ('Secretary',  '#0369a1', 6),
  ('Newsletter', '#c026d3', 7),
  ('Grounds',    '#4d7c0f', 8),
  ('Pool',       '#0891b2', 9),
  ('Social',     '#db2777', 10),
  ('Residents',  '#57534e', 11);
```

- [ ] **Step 3: Append the seed — events (area resolved by name)**

Transcribe EVERY event row from the seed table in `docs/specs/operating-calendar.md` (40 events; the `Board | Annual HOA meeting held` row is intentionally absent — do not add it). Each insert resolves `area_id` from the area name. Pattern (first three shown — continue for all 40, titles are unique):

```sql
-- ── Seed: events ─────────────────────────────────────────────────────────
insert into calendar_events (area_id, title, responsible_party, notes) values
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Monthly clubhouse cleaning', 'Clubhouse Chair', 'May task schedules ongoing cleanings'),
  ((select id from responsibility_areas where name = 'Clubhouse'),
   'Replace HVAC filter', 'Clubhouse Chair', null),
  ((select id from responsibility_areas where name = 'Homeside'),
   'Secretary of State filing due', 'Homeside', 'due 3/1');
  -- … continue for all 40 events from the spec seed table …
```

- [ ] **Step 4: Append the seed — occurrences (event resolved by title)**

For each event, the `Months` braces in the spec become one occurrence row per month; the `Day` column becomes `day_of_month` (blank → `null`). Pattern:

```sql
-- ── Seed: occurrences (one row per month per event) ──────────────────────
insert into event_occurrences (event_id, month, day_of_month) values
  -- Replace HVAC filter {1,5,7}
  ((select id from calendar_events where title = 'Replace HVAC filter'), 1, null),
  ((select id from calendar_events where title = 'Replace HVAC filter'), 5, null),
  ((select id from calendar_events where title = 'Replace HVAC filter'), 7, null),
  -- Secretary of State filing due {3} day 1
  ((select id from calendar_events where title = 'Secretary of State filing due'), 3, 1),
  -- Property check — violations reporting {1..12}
  ((select id from calendar_events where title = 'Property check — violations reporting'), 1, null),
  -- … months 2–12 for Property check, and every other event's months from the spec …
```

Transcription rules (apply to all rows):
- A bare month in braces (no `Day`) → `day_of_month = null`.
- A `Day` value → that integer (e.g. taxes `{6}` day `15`; dues `{4}` day `1`; SoS `{3}` day `1`; bike parade `{7}` day `4`; "Dues letter & invoice received by residents" `{3}` day `1`).
- "Property check — violations reporting" expands to 12 occurrence rows (months 1–12), all `null` day.

- [ ] **Step 5: Verify locally**

This migration is hand-run by Jake in the Supabase SQL editor (e2e then prod). For this plan, verify the SQL parses by counting statements and confirming no obvious typos:

Run: `grep -c "insert into event_occurrences" supabase/migrations/0019_operating_calendar.sql`
Expected: `1` (one multi-row insert). Then eyeball: every `(select id from calendar_events where title = …)` title must exactly match a title in the events insert.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0019_operating_calendar.sql
git commit -m "feat: add operating calendar schema + seed (migration 0019)"
```

---

## Task 2: Database types

**Files:**
- Modify: `types/database.ts`

**Context:** Every table type needs `Relationships: []` or the typed client's `from()` collapses to `never` (see CLAUDE.md). Add the three table blocks inside `Database["public"]["Tables"]`, then add convenience row-type exports next to the existing ones at the bottom.

- [ ] **Step 1: Add the three table types**

Inside `Database["public"]["Tables"]`, add:

```ts
      responsibility_areas: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          area_id: string;
          title: string;
          responsible_party: string | null;
          notes: string | null;
          template_url: string | null;
          created_by_position_id: string | null;
          created_at: string;
          updated_by_position_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          title: string;
          responsible_party?: string | null;
          notes?: string | null;
          template_url?: string | null;
          created_by_position_id?: string | null;
          created_at?: string;
          updated_by_position_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          title?: string;
          responsible_party?: string | null;
          notes?: string | null;
          template_url?: string | null;
          updated_by_position_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_occurrences: {
        Row: {
          id: string;
          event_id: string;
          month: number;
          day_of_month: number | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          month: number;
          day_of_month?: number | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          month?: number;
          day_of_month?: number | null;
        };
        Relationships: [];
      };
```

- [ ] **Step 2: Add convenience row types**

Next to the other `export type X = Database[...]["Row"]` lines at the bottom:

```ts
export type ResponsibilityArea = Database["public"]["Tables"]["responsibility_areas"]["Row"];
export type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
export type EventOccurrence = Database["public"]["Tables"]["event_occurrences"]["Row"];
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm type-check`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat: add operating calendar table types"
```

---

## Task 3: Pure helpers + tests

**Files:**
- Create: `lib/calendar/calendar.ts`
- Test: `lib/calendar/calendar.test.ts`

**Context:** This module is the shared contract for the page, widget, and CRUD. It flattens the three tables into a `CalendarItem`, computes effective dates (`day_of_month ?? lastDayOfMonth`), groups by month (Jan→Dec), and computes the year-wrapping "upcoming" order. No `date-fns`. Follow the `lib/dates.test.ts` style (fixed dates, behavior assertions).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/calendar/calendar.test.ts
import {
  lastDayOfMonth,
  effectiveDate,
  buildCalendarItems,
  groupByMonth,
  upcomingItems,
  monthName,
  formatItemDate,
  type CalendarItem,
} from "./calendar";
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

const area: ResponsibilityArea = {
  id: "a1", name: "Pool", color: "#0891b2", sort_order: 9,
  created_at: "2026-01-01T00:00:00Z",
};
const event: CalendarEvent = {
  id: "e1", area_id: "a1", title: "Pool opens", responsible_party: "Pool Chair",
  notes: null, template_url: null, created_by_position_id: null,
  created_at: "2026-01-01T00:00:00Z", updated_by_position_id: null,
  updated_at: "2026-01-01T00:00:00Z",
};
const occ = (over: Partial<EventOccurrence>): EventOccurrence => ({
  id: "o1", event_id: "e1", month: 5, day_of_month: null, ...over,
});
const item = (over: Partial<CalendarItem>): CalendarItem => ({
  occurrenceId: "o1", eventId: "e1", title: "Pool opens", month: 5,
  dayOfMonth: null, areaId: "a1", areaName: "Pool", areaColor: "#0891b2",
  responsibleParty: "Pool Chair", notes: null, templateUrl: null, ...over,
});

describe("lastDayOfMonth", () => {
  it("returns 31 for March", () => expect(lastDayOfMonth(2026, 3)).toBe(31));
  it("returns 28 for a non-leap February", () => expect(lastDayOfMonth(2026, 2)).toBe(28));
  it("returns 29 for a leap February", () => expect(lastDayOfMonth(2028, 2)).toBe(29));
});

describe("effectiveDate", () => {
  it("uses day_of_month when set", () => {
    const d = effectiveDate({ month: 3, dayOfMonth: 1 }, 2026);
    expect(d.getMonth()).toBe(2); // March (0-based)
    expect(d.getDate()).toBe(1);
  });
  it("falls back to the last day of the month when day is null", () => {
    const d = effectiveDate({ month: 2, dayOfMonth: null }, 2026);
    expect(d.getDate()).toBe(28);
  });
});

describe("buildCalendarItems", () => {
  it("flattens an occurrence with its event and area", () => {
    const items = buildCalendarItems([area], [event], [occ({})]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Pool opens", month: 5, areaName: "Pool", areaColor: "#0891b2",
    });
  });
  it("drops occurrences whose event or area is missing", () => {
    expect(buildCalendarItems([], [event], [occ({})])).toHaveLength(0);
    expect(buildCalendarItems([area], [], [occ({})])).toHaveLength(0);
  });
});

describe("groupByMonth", () => {
  it("returns only months that have items, in Jan→Dec order", () => {
    const groups = groupByMonth([item({ month: 5 }), item({ month: 1 })]);
    expect(groups.map((g) => g.month)).toEqual([1, 5]);
  });
  it("sorts items within a month by day, month-end (null) last", () => {
    const groups = groupByMonth([
      item({ month: 3, dayOfMonth: null, title: "end" }),
      item({ month: 3, dayOfMonth: 1, title: "first" }),
    ]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["first", "end"]);
  });
});

describe("upcomingItems", () => {
  const today = new Date(2026, 10, 15); // Nov 15, 2026

  it("orders by next effective date from today", () => {
    const result = upcomingItems(
      [item({ month: 12, title: "Dec" }), item({ month: 11, dayOfMonth: 20, title: "Nov20" })],
      today
    );
    expect(result.map((i) => i.title)).toEqual(["Nov20", "Dec"]);
  });

  it("wraps items already past this year into next year (after later-this-year items)", () => {
    const result = upcomingItems(
      [item({ month: 1, title: "Jan (next yr)" }), item({ month: 12, title: "Dec (this yr)" })],
      today
    );
    expect(result.map((i) => i.title)).toEqual(["Dec (this yr)", "Jan (next yr)"]);
  });
});

describe("monthName / formatItemDate", () => {
  it("names months", () => expect(monthName(3)).toBe("March"));
  it("prefixes month-end deadlines with 'by'", () => {
    expect(formatItemDate(item({ month: 3, dayOfMonth: null }), 2026)).toMatch(/^by Mar/);
  });
  it("shows the exact day when set", () => {
    expect(formatItemDate(item({ month: 3, dayOfMonth: 1 }), 2026)).toBe("Mar 1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test lib/calendar/calendar.test.ts`
Expected: FAIL with "Cannot find module './calendar'".

- [ ] **Step 3: Write the implementation**

```ts
// lib/calendar/calendar.ts
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

/**
 * A single event occurrence flattened with its parent event and responsibility
 * area, ready to render and sort. Built once per page from the three calendar
 * tables; all downstream helpers operate on this flat shape.
 */
export type CalendarItem = {
  occurrenceId: string;
  eventId: string;
  title: string;
  month: number; // 1–12
  dayOfMonth: number | null;
  areaId: string;
  areaName: string;
  areaColor: string; // hex
  responsibleParty: string | null;
  notes: string | null;
  templateUrl: string | null;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Returns the last calendar day (28–31) of a 1-based month in a given year.
 * Uses JS Date's day-0 rollover: day 0 of month N is the last day of month N-1.
 *
 * @param year  - Full year (e.g. 2026)
 * @param month - 1-based month (1 = January)
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Effective date of an occurrence in a given year: its `dayOfMonth` if set,
 * otherwise the last day of that month (a "by month-end" deadline).
 *
 * @param occ  - The occurrence's month (1-based) and optional day
 * @param year - The calendar year to resolve against
 */
export function effectiveDate(
  occ: { month: number; dayOfMonth: number | null },
  year: number
): Date {
  const day = occ.dayOfMonth ?? lastDayOfMonth(year, occ.month);
  return new Date(year, occ.month - 1, day);
}

/**
 * Flattens the three calendar tables into render-ready `CalendarItem`s.
 * Occurrences whose event or area cannot be resolved are dropped (defensive
 * against partial data). One item per occurrence.
 *
 * @param areas       - All responsibility areas
 * @param events      - All calendar events
 * @param occurrences - All event occurrences
 */
export function buildCalendarItems(
  areas: ResponsibilityArea[],
  events: CalendarEvent[],
  occurrences: EventOccurrence[]
): CalendarItem[] {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  return occurrences.flatMap((o) => {
    const event = eventById.get(o.event_id);
    if (!event) return [];
    const area = areaById.get(event.area_id);
    if (!area) return [];
    return [
      {
        occurrenceId: o.id,
        eventId: event.id,
        title: event.title,
        month: o.month,
        dayOfMonth: o.day_of_month,
        areaId: area.id,
        areaName: area.name,
        areaColor: area.color,
        responsibleParty: event.responsible_party,
        notes: event.notes,
        templateUrl: event.template_url,
      },
    ];
  });
}

/**
 * Groups items by calendar month in Jan→Dec order. Only months that contain at
 * least one item are returned. Items within a month are sorted by day, with
 * month-end (null day) deadlines sorted last.
 *
 * @param items - Flat calendar items (already area-filtered if desired)
 */
export function groupByMonth(
  items: CalendarItem[]
): { month: number; items: CalendarItem[] }[] {
  const byMonth = new Map<number, CalendarItem[]>();
  for (const it of items) {
    const list = byMonth.get(it.month) ?? [];
    list.push(it);
    byMonth.set(it.month, list);
  }
  return Array.from(byMonth.keys())
    .sort((a, b) => a - b)
    .map((month) => ({
      month,
      items: byMonth
        .get(month)!
        .slice()
        .sort((a, b) => (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99)),
    }));
}

/**
 * Returns items ordered by their next effective date from `today`, wrapping
 * past year-end. An item whose effective date this year has already passed is
 * treated as next year's, so the list never empties late in the year.
 *
 * @param items - Flat calendar items
 * @param today - Reference date (default now; pass a fixed date in tests)
 */
export function upcomingItems(
  items: CalendarItem[],
  today: Date = new Date()
): CalendarItem[] {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const year = startOfToday.getFullYear();
  return items
    .map((it) => {
      let when = effectiveDate(it, year);
      if (when < startOfToday) when = effectiveDate(it, year + 1);
      return { it, when };
    })
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .map((x) => x.it);
}

/**
 * Full English name of a 1-based month (1 → "January").
 *
 * @param month - 1-based month
 */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

/**
 * Formats an item's effective date as a short label. Month-end deadlines
 * (null day) are prefixed with "by" (e.g. "by Mar 31"); fixed days show the
 * exact date (e.g. "Mar 1").
 *
 * @param item - The calendar item
 * @param year - Year to resolve the date against (default current year)
 */
export function formatItemDate(
  item: CalendarItem,
  year: number = new Date().getFullYear()
): string {
  const d = effectiveDate(item, year);
  const formatted = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return item.dayOfMonth == null ? `by ${formatted}` : formatted;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test lib/calendar/calendar.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/calendar.ts lib/calendar/calendar.test.ts
git commit -m "feat: add operating calendar pure helpers + tests"
```

---

## Task 4: Server actions (CRUD)

**Files:**
- Create: `actions/calendar.ts`

**Context:** Mirror the `actions/settings.ts` shape: `"use server"`, resolve the user's role, gate with `canEditAll`, return `string | undefined` (error message or success), `revalidatePath`. RLS also enforces this; the explicit check produces a clear message. Events and their occurrences are saved together (replace-all occurrences on update).

- [ ] **Step 1: Write the actions**

```ts
// actions/calendar.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { canEditAll } from "@/lib/permissions";
import type { PositionRole } from "@/types/database";

/** One occurrence to persist for an event. */
export type OccurrenceInput = { month: number; dayOfMonth: number | null };

/** Fields for creating or updating a calendar event. */
export type EventInput = {
  id?: string;
  areaId: string;
  title: string;
  responsibleParty: string | null;
  notes: string | null;
  templateUrl: string | null;
  occurrences: OccurrenceInput[];
};

/** Fields for creating or updating a responsibility area. */
export type AreaInput = {
  id?: string;
  name: string;
  color: string;
  sortOrder: number;
};

/**
 * Resolves the signed-in user's position and whether they may edit the calendar.
 * Returns the server client alongside so callers reuse one connection.
 */
async function resolveEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: position } = await supabase
    .from("positions")
    .select("id, role")
    .eq("email", user?.email ?? "")
    .single();
  const allowed = !!position && canEditAll(position.role as PositionRole);
  return { supabase, positionId: position?.id ?? null, allowed };
}

/** Revalidates the surfaces that read calendar data. */
function revalidateCalendar(): void {
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
}

/**
 * Creates or updates a responsibility area.
 * Only president/officer (canEditAll). Returns an error message or undefined.
 *
 * @param input - Area fields; include `id` to update, omit to create
 */
export async function saveArea(input: AreaInput): Promise<string | undefined> {
  if (!input.name.trim()) return "Area name is required.";
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return "Color must be a hex value like #0f766e.";

  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const row = {
    name: input.name.trim(),
    color: input.color,
    sort_order: input.sortOrder,
  };
  const { error } = input.id
    ? await supabase.from("responsibility_areas").update(row).eq("id", input.id)
    : await supabase.from("responsibility_areas").insert(row);

  if (error) return error.message;
  revalidateCalendar();
}

/**
 * Deletes a responsibility area. Blocked if any events still reference it
 * (the FK is `on delete restrict`; this returns a friendly message first).
 *
 * @param id - The area id
 */
export async function deleteArea(id: string): Promise<string | undefined> {
  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const { count } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("area_id", id);
  if ((count ?? 0) > 0) return "Reassign or delete this area's events before deleting it.";

  const { error } = await supabase.from("responsibility_areas").delete().eq("id", id);
  if (error) return error.message;
  revalidateCalendar();
}

/**
 * Creates or updates an event together with its occurrences (replace-all).
 * Only president/officer (canEditAll). Returns an error message or undefined.
 *
 * @param input - Event fields + the full set of occurrences
 */
export async function saveEvent(input: EventInput): Promise<string | undefined> {
  if (!input.title.trim()) return "Title is required.";
  if (!input.areaId) return "An area is required.";
  if (input.occurrences.length === 0) return "Add at least one month.";

  const { supabase, positionId, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const fields = {
    area_id: input.areaId,
    title: input.title.trim(),
    responsible_party: input.responsibleParty,
    notes: input.notes,
    template_url: input.templateUrl,
  };

  let eventId = input.id;
  if (eventId) {
    const { error } = await supabase
      .from("calendar_events")
      .update({ ...fields, updated_by_position_id: positionId, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) return error.message;
    const { error: delErr } = await supabase
      .from("event_occurrences")
      .delete()
      .eq("event_id", eventId);
    if (delErr) return delErr.message;
  } else {
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({ ...fields, created_by_position_id: positionId })
      .select("id")
      .single();
    if (error) return error.message;
    eventId = data.id;
  }

  const rows = input.occurrences.map((o) => ({
    event_id: eventId!,
    month: o.month,
    day_of_month: o.dayOfMonth,
  }));
  const { error: occErr } = await supabase.from("event_occurrences").insert(rows);
  if (occErr) return occErr.message;

  revalidateCalendar();
}

/**
 * Deletes an event; its occurrences cascade away.
 *
 * @param id - The event id
 */
export async function deleteEvent(id: string): Promise<string | undefined> {
  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) return error.message;
  revalidateCalendar();
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add actions/calendar.ts
git commit -m "feat: add operating calendar CRUD server actions"
```

---

## Task 5: `/calendar` read page + filter + nav

**Files:**
- Create: `app/(dashboard)/calendar/page.tsx`
- Create: `components/hoa/CalendarView.tsx`
- Test: `components/hoa/CalendarView.test.tsx`
- Modify: `components/hoa/index.ts`
- Modify: `components/hoa/Sidebar.tsx`

**Context:** Everyone reads this page — **no chair redirect**. The page (server) fetches the three tables as separate queries, builds items, and passes them to a client `CalendarView` that owns the area filter + legend and renders month sections. `canEditAll` users see a "Manage" link. Build a Button-as-Link with `nativeButton={false} render={<Link/>}` (shadcn v4 / `@base-ui/react` — no `asChild`).

- [ ] **Step 1: Write the failing filter test**

```tsx
// components/hoa/CalendarView.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarView } from "./CalendarView";
import type { CalendarItem } from "@/lib/calendar/calendar";

const items: CalendarItem[] = [
  { occurrenceId: "1", eventId: "e1", title: "Pool opens", month: 5, dayOfMonth: null,
    areaId: "pool", areaName: "Pool", areaColor: "#0891b2",
    responsibleParty: null, notes: null, templateUrl: null },
  { occurrenceId: "2", eventId: "e2", title: "Legal retainer due", month: 1, dayOfMonth: null,
    areaId: "homeside", areaName: "Homeside", areaColor: "#0f766e",
    responsibleParty: null, notes: null, templateUrl: null },
];

describe("CalendarView", () => {
  it("shows all events by default", () => {
    render(<CalendarView items={items} />);
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.getByText("Legal retainer due")).toBeInTheDocument();
  });

  it("filters to a single area when its toggle is clicked", async () => {
    render(<CalendarView items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /^Pool$/ }));
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.queryByText("Legal retainer due")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test components/hoa/CalendarView.test.tsx`
Expected: FAIL with "Cannot find module './CalendarView'".

- [ ] **Step 3: Write `CalendarView`**

```tsx
// components/hoa/CalendarView.tsx
"use client";

import { useMemo, useState } from "react";
import {
  groupByMonth,
  monthName,
  formatItemDate,
  type CalendarItem,
} from "@/lib/calendar/calendar";
import { EmptyState } from "./EmptyState";

interface CalendarViewProps {
  /** All calendar items for the current year, pre-built by the page. */
  items: CalendarItem[];
}

/** Distinct {id, name, color} areas present in the items, in first-seen order. */
function areaLegend(items: CalendarItem[]) {
  const seen = new Map<string, { id: string; name: string; color: string }>();
  for (const it of items) {
    if (!seen.has(it.areaId))
      seen.set(it.areaId, { id: it.areaId, name: it.areaName, color: it.areaColor });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read-only operating calendar: a color-coded legend of responsibility areas
 * (click to filter) over month-grouped event sections (Jan→Dec).
 *
 * @param items - Flat calendar items for the current year
 */
export function CalendarView({ items }: CalendarViewProps) {
  const legend = useMemo(() => areaLegend(items), [items]);
  const [activeArea, setActiveArea] = useState<string | null>(null);

  const visible = activeArea ? items.filter((i) => i.areaId === activeArea) : items;
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {legend.map((a) => {
          const active = activeArea === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveArea(active ? null : a.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                active ? "border-foreground" : "border-border hover:bg-muted"
              }`}
              aria-pressed={active}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: a.color }}
              />
              {a.name}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No calendar events yet" />
      ) : (
        groups.map((group) => (
          <section key={group.month} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthName(group.month)}
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border">
              {group.items.map((it) => (
                <li key={it.occurrenceId} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.areaColor }}
                    title={it.areaName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{it.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatItemDate(it)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.areaName}
                      {it.responsibleParty ? ` · ${it.responsibleParty}` : ""}
                    </div>
                    {it.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>
                    ) : null}
                    {it.templateUrl ? (
                      <a
                        href={it.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        Template
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test components/hoa/CalendarView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the page**

```tsx
// app/(dashboard)/calendar/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CalendarView } from "@/components/hoa/CalendarView";
import { Button } from "@/components/ui/button";
import { canEditAll } from "@/lib/permissions";
import { buildCalendarItems } from "@/lib/calendar/calendar";
import type { PositionRole } from "@/types/database";

export const metadata = { title: "Operating Calendar — HOA Board" };

/**
 * Operating Calendar — board-wide annual cycle, readable by everyone
 * (including committee chairs, so there is no chair redirect here).
 */
export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [posResult, areasResult, eventsResult, occResult] = await Promise.all([
    supabase.from("positions").select("role").eq("email", user.email!).single(),
    supabase.from("responsibility_areas").select("*").order("sort_order"),
    supabase.from("calendar_events").select("*").order("title"),
    supabase.from("event_occurrences").select("*"),
  ]);

  const role = posResult.data?.role as PositionRole | undefined;
  const items = buildCalendarItems(
    areasResult.data ?? [],
    eventsResult.data ?? [],
    occResult.data ?? []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operating Calendar"
        subtitle="The HOA's recurring annual cycle across all responsibility areas."
        action={
          role && canEditAll(role) ? (
            <Button nativeButton={false} render={<Link href="/calendar/manage" />}>
              Manage
            </Button>
          ) : undefined
        }
      />
      <CalendarView items={items} />
    </div>
  );
}
```

NOTE: confirm `PageHeader`'s right-action prop name by reading `components/hoa/PageHeader.tsx` before writing — the CLAUDE.md describes it as "optional right action". Use the actual prop name.

- [ ] **Step 6: Export `CalendarView` and add nav**

In `components/hoa/index.ts` add:
```ts
export { CalendarView } from "./CalendarView";
```

In `components/hoa/Sidebar.tsx`, add Calendar to the board nav array:
```ts
const FUNCTION_NAV: NavItem[] = [
  { label: "Meetings", href: "/meetings" },
  { label: "Calendar", href: "/calendar" },
  { label: "Architecture", href: "/architecture" },
  // … rest unchanged …
];
```
And add it to the chair branch's `<ul>` (chairs read the calendar too), after the Treasury link:
```tsx
<SidebarLink item={{ label: "Calendar", href: "/calendar" }} active={isActive("/calendar")} />
```

- [ ] **Step 7: Verify**

Run: `pnpm test components/hoa/CalendarView.test.tsx && pnpm type-check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/calendar/page.tsx components/hoa/CalendarView.tsx components/hoa/CalendarView.test.tsx components/hoa/index.ts components/hoa/Sidebar.tsx
git commit -m "feat: add /calendar read view, area filter, and nav"
```

---

## Task 6: Admin CRUD UI

**Files:**
- Create: `app/(dashboard)/calendar/manage/page.tsx`
- Create: `components/hoa/CalendarAdmin.tsx`
- Modify: `components/hoa/index.ts`

**Context:** President/officer only — gate with `canEditAll` exactly like `app/(dashboard)/admin/settings/page.tsx` (redirect chairs to their committee page, redirect non-editors to `/dashboard`). The client component manages areas (name/color/sort, delete) and events (area/title/responsible/notes/template + month checkboxes with optional per-month day, delete) via the Task 4 actions. Use `useTransition` + inline feedback like `SettingRow`.

- [ ] **Step 1: Write the admin page (gate + fetch)**

```tsx
// app/(dashboard)/calendar/manage/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CalendarAdmin } from "@/components/hoa/CalendarAdmin";
import type { PositionRole } from "@/types/database";

export const metadata = { title: "Manage Calendar — HOA Board" };

/** Admin CRUD for the operating calendar — president/officer only. */
export default async function ManageCalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!position) redirect("/login");
  if (isChair(position.role)) redirect(`/committee/${position.name}`);
  if (!canEditAll(position.role as PositionRole)) redirect("/dashboard");

  const [areasResult, eventsResult, occResult] = await Promise.all([
    supabase.from("responsibility_areas").select("*").order("sort_order"),
    supabase.from("calendar_events").select("*").order("title"),
    supabase.from("event_occurrences").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Calendar"
        subtitle="Add, edit, and remove responsibility areas and events."
      />
      <CalendarAdmin
        areas={areasResult.data ?? []}
        events={eventsResult.data ?? []}
        occurrences={occResult.data ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write `CalendarAdmin`**

```tsx
// components/hoa/CalendarAdmin.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveArea,
  deleteArea,
  saveEvent,
  deleteEvent,
  type EventInput,
} from "@/actions/calendar";
import { monthName } from "@/lib/calendar/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "./SectionCard";
import { InlineConfirm } from "./InlineConfirm";
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

interface CalendarAdminProps {
  areas: ResponsibilityArea[];
  events: CalendarEvent[];
  occurrences: EventOccurrence[];
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Empty draft for a new event. */
function emptyEvent(areaId: string): EventInput {
  return {
    areaId,
    title: "",
    responsibleParty: null,
    notes: null,
    templateUrl: null,
    occurrences: [],
  };
}

/**
 * Admin editor for the operating calendar. Two sections: responsibility areas
 * (name/color/sort) and events (area, fields, and month/day occurrences). All
 * mutations go through server actions; on success the router refreshes so the
 * server re-fetches.
 */
export function CalendarAdmin({ areas, events, occurrences }: CalendarAdminProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Runs an action, surfaces its error, and refreshes on success. */
  const run = (fn: () => Promise<string | undefined>) => {
    setError(null);
    startTransition(async () => {
      const message = await fn();
      if (message) setError(message);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SectionCard title="Responsibility Areas">
        <AreaEditor areas={areas} disabled={isPending} run={run} />
      </SectionCard>

      <SectionCard title="Events">
        <EventEditor
          areas={areas}
          events={events}
          occurrences={occurrences}
          disabled={isPending}
          run={run}
        />
      </SectionCard>
    </div>
  );
}

/** Area list with inline add + edit-in-place + delete. */
function AreaEditor({
  areas,
  disabled,
  run,
}: {
  areas: ResponsibilityArea[];
  disabled: boolean;
  run: (fn: () => Promise<string | undefined>) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f766e");

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {areas.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: a.color }}
            />
            <span className="flex-1 text-sm">{a.name}</span>
            <InlineConfirm
              label="Delete"
              onConfirm={() => run(() => deleteArea(a.id))}
            />
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="New area name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
          />
        </div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Area color"
          className="h-9 w-12 rounded border border-border"
        />
        <Button
          disabled={disabled || !name.trim()}
          onClick={() =>
            run(async () => {
              const msg = await saveArea({
                name,
                color,
                sortOrder: areas.length + 1,
              });
              if (!msg) setName("");
              return msg;
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/** Event list with an add/edit form (area, fields, month+day occurrences). */
function EventEditor({
  areas,
  events,
  occurrences,
  disabled,
  run,
}: {
  areas: ResponsibilityArea[];
  events: CalendarEvent[];
  occurrences: EventOccurrence[];
  disabled: boolean;
  run: (fn: () => Promise<string | undefined>) => void;
}) {
  const [draft, setDraft] = useState<EventInput | null>(null);

  /** Opens the form for an existing event, hydrating its occurrences. */
  const editExisting = (event: CalendarEvent) => {
    setDraft({
      id: event.id,
      areaId: event.area_id,
      title: event.title,
      responsibleParty: event.responsible_party,
      notes: event.notes,
      templateUrl: event.template_url,
      occurrences: occurrences
        .filter((o) => o.event_id === event.id)
        .map((o) => ({ month: o.month, dayOfMonth: o.day_of_month })),
    });
  };

  /** Toggles a month on/off in the draft (day defaults to null = month-end). */
  const toggleMonth = (month: number) => {
    if (!draft) return;
    const has = draft.occurrences.some((o) => o.month === month);
    setDraft({
      ...draft,
      occurrences: has
        ? draft.occurrences.filter((o) => o.month !== month)
        : [...draft.occurrences, { month, dayOfMonth: null }],
    });
  };

  /** Sets the optional day for a selected month. */
  const setDay = (month: number, day: number | null) => {
    if (!draft) return;
    setDraft({
      ...draft,
      occurrences: draft.occurrences.map((o) =>
        o.month === month ? { ...o, dayOfMonth: day } : o
      ),
    });
  };

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2">
            <span className="flex-1 text-sm">
              <span className="font-medium">{e.title}</span>{" "}
              <span className="text-xs text-muted-foreground">· {areaName(e.area_id)}</span>
            </span>
            <Button variant="outline" disabled={disabled} onClick={() => editExisting(e)}>
              Edit
            </Button>
            <InlineConfirm label="Delete" onConfirm={() => run(() => deleteEvent(e.id))} />
          </li>
        ))}
      </ul>

      {draft === null ? (
        <Button
          variant="outline"
          disabled={disabled || areas.length === 0}
          onClick={() => setDraft(emptyEvent(areas[0]?.id ?? ""))}
        >
          Add event
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-border p-4">
          <select
            value={draft.areaId}
            onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-label="Area"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Input
            placeholder="Responsible party (optional)"
            value={draft.responsibleParty ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, responsibleParty: e.target.value || null })
            }
          />
          <Input
            placeholder="Notes (optional)"
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
          />
          <Input
            placeholder="Template URL (optional)"
            value={draft.templateUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, templateUrl: e.target.value || null })}
          />

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Months (leave day blank for end-of-month)
            </p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {MONTHS.map((m) => {
                const occ = draft.occurrences.find((o) => o.month === m);
                return (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!occ}
                      onChange={() => toggleMonth(m)}
                    />
                    <span className="w-9">{monthName(m).slice(0, 3)}</span>
                    {occ ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="day"
                        value={occ.dayOfMonth ?? ""}
                        onChange={(e) =>
                          setDay(m, e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-16 rounded border border-border px-1 py-0.5 text-xs"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              disabled={disabled}
              onClick={() => {
                const payload = draft;
                run(async () => {
                  const msg = await saveEvent(payload);
                  if (!msg) setDraft(null);
                  return msg;
                });
              }}
            >
              Save
            </Button>
            <Button variant="outline" disabled={disabled} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

NOTE before writing: read `components/hoa/InlineConfirm.tsx` and `components/ui/button.tsx` to confirm the `InlineConfirm` props (`label` / `onConfirm`) and the `Button` `variant` values (`"outline"` etc.) match. Adjust names to the real API.

- [ ] **Step 3: Export `CalendarAdmin`**

In `components/hoa/index.ts` add:
```ts
export { CalendarAdmin } from "./CalendarAdmin";
```

- [ ] **Step 4: Verify**

Run: `pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/calendar/manage/page.tsx components/hoa/CalendarAdmin.tsx components/hoa/index.ts
git commit -m "feat: add operating calendar admin CRUD"
```

---

## Task 7: Dashboard upcoming widget

**Files:**
- Create: `components/hoa/UpcomingCalendarWidget.tsx`
- Test: `components/hoa/UpcomingCalendarWidget.test.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/hoa/index.ts`

**Context:** A read-only "top ~5 upcoming" card for the dashboard. The widget itself is a pure presentational component over pre-sorted items, so it's easy to test; the page does the fetch + `upcomingItems(...).slice(0, 5)`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/hoa/UpcomingCalendarWidget.test.tsx
import { render, screen } from "@testing-library/react";
import { UpcomingCalendarWidget } from "./UpcomingCalendarWidget";
import type { CalendarItem } from "@/lib/calendar/calendar";

const items: CalendarItem[] = [
  { occurrenceId: "1", eventId: "e1", title: "Pool opens", month: 5, dayOfMonth: null,
    areaId: "pool", areaName: "Pool", areaColor: "#0891b2",
    responsibleParty: null, notes: null, templateUrl: null },
];

describe("UpcomingCalendarWidget", () => {
  it("renders each item's title and area", () => {
    render(<UpcomingCalendarWidget items={items} />);
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<UpcomingCalendarWidget items={[]} />);
    expect(screen.getByText(/no upcoming/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test components/hoa/UpcomingCalendarWidget.test.tsx`
Expected: FAIL with "Cannot find module './UpcomingCalendarWidget'".

- [ ] **Step 3: Write the widget**

```tsx
// components/hoa/UpcomingCalendarWidget.tsx
import Link from "next/link";
import { formatItemDate, type CalendarItem } from "@/lib/calendar/calendar";
import { SectionCard } from "./SectionCard";
import { EmptyState } from "./EmptyState";

interface UpcomingCalendarWidgetProps {
  /** Pre-sorted upcoming items (already sliced to the desired count). */
  items: CalendarItem[];
}

/**
 * Dashboard card listing the next handful of upcoming calendar items.
 * Presentational only — the caller sorts and slices.
 *
 * @param items - Upcoming calendar items in display order
 */
export function UpcomingCalendarWidget({ items }: UpcomingCalendarWidgetProps) {
  return (
    <SectionCard
      title="Upcoming on the Calendar"
      description={
        <Link href="/calendar" className="text-primary hover:underline">
          View full calendar
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState title="No upcoming events" />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.occurrenceId} className="flex items-start gap-2 text-sm">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: it.areaColor }}
              />
              <span className="flex-1">
                <span className="font-medium">{it.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{it.areaName}</span>
              </span>
              <span className="text-xs text-muted-foreground">{formatItemDate(it)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
```

NOTE: confirm `SectionCard`'s `description` prop accepts a `ReactNode` (read `components/hoa/SectionCard.tsx`). If it is typed `string`, pass the link as `children`/an `action` slot instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test components/hoa/UpcomingCalendarWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it on the dashboard**

In `app/(dashboard)/dashboard/page.tsx`:

Add imports:
```ts
import { UpcomingCalendarWidget } from "@/components/hoa/UpcomingCalendarWidget";
import { buildCalendarItems, upcomingItems } from "@/lib/calendar/calendar";
```

Add three queries to the existing `Promise.all` (extend the destructure):
```ts
  const [archResult, craResult, meetingResult, areasResult, eventsResult, occResult] =
    await Promise.all([
      // … existing three queries unchanged …
      supabase.from("responsibility_areas").select("*"),
      supabase.from("calendar_events").select("*"),
      supabase.from("event_occurrences").select("*"),
    ]);

  const upcoming = upcomingItems(
    buildCalendarItems(areasResult.data ?? [], eventsResult.data ?? [], occResult.data ?? [])
  ).slice(0, 5);
```

Render the widget inside the existing `grid gap-4 md:grid-cols-2` block (as a third card):
```tsx
        <UpcomingCalendarWidget items={upcoming} />
```

- [ ] **Step 6: Export + verify**

In `components/hoa/index.ts` add:
```ts
export { UpcomingCalendarWidget } from "./UpcomingCalendarWidget";
```

Run: `pnpm test components/hoa/UpcomingCalendarWidget.test.tsx && pnpm type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/hoa/UpcomingCalendarWidget.tsx components/hoa/UpcomingCalendarWidget.test.tsx app/(dashboard)/dashboard/page.tsx components/hoa/index.ts
git commit -m "feat: add upcoming calendar dashboard widget"
```

---

## Final verification (after all tasks merge)

- [ ] Run the full suite: `pnpm test --ci` (existing 221 + new tests pass).
- [ ] `pnpm type-check` and `pnpm lint` clean.
- [ ] Jake runs `0019` in the e2e Supabase SQL editor, then loads `/calendar` (everyone), `/calendar/manage` (president/officer only), and the dashboard widget.
- [ ] Confirm a committee-chair account can reach `/calendar` but is redirected away from `/calendar/manage`.

---

## Notes / explicitly NOT in v1

- No completion/check-off, no month-grid view, no year navigation, no `date-fns`, no scheduled-email reminders. These are documented fast-follows in `docs/specs/operating-calendar.md`.
- Seed data ships from the draft; Jake red-lines it post-deploy via `/calendar/manage`.
- The static "annual HOA meeting held" event is intentionally omitted — it will arrive via a future meetings→calendar integration.
