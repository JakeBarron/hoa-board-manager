# CRA Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRA (Capital Reserve Analysis) project tracker — a card-based list, a create form, and an inline-editable detail page with quotes, an immutable updates log, and document attachments — gated so the CRA committee chair can manage it.

**Architecture:** Next.js 16 App Router pages (Server Components) under `app/(dashboard)/cra/`, server actions in `actions/cra.ts`, pure helpers in `lib/cra/` and `lib/money.ts`, client components in `components/hoa/`. Data + auth via Supabase with RLS enforcing CRA-editor writes. Money stored as integer cents to match treasury.

**Tech Stack:** Next.js 16, TypeScript, Supabase (Postgres + RLS + Storage), Tailwind v4 + shadcn/ui v4 (`@base-ui/react`), Jest + React Testing Library, pnpm.

**Spec:** `docs/specs/cra-projects.md` (read it first — this plan implements it).

## Global Constraints

- **Money is integer cents** everywhere (`estimated_cost`, `actual_cost`, quote `amount`). Parse dollars→cents on input, format cents→dollars on display. Never store dollars.
- **RLS is the real authorization.** App-layer `canEditCRA` is for clear errors only; the DB policies in Task 1 are what actually gate writes.
- **shadcn/ui v4:** no `asChild`. Render a Button as a Link with `<Button nativeButton={false} render={<Link href="…" />}>`.
- **Next.js 16:** `params` and `searchParams` are Promises — always `await` them. Cast URL params to enum types in `.eq()`.
- **Supabase types:** every table type keeps `Relationships: []`. Never inline-destructure `{ data }` from `Promise.all`.
- **Standards:** JSDoc on every exported function; no default exports except Next.js page/layout files; absolute `@/` imports; tests co-located; test behavior not implementation.
- **Migration 0022 precondition:** all four `cra_*` tables must be empty (verified: no seed/script inserts). Confirm `select count(*)` is 0 on each before applying.

---

### Task 1: Migration 0022 — schema changes + RLS

**Files:**
- Create: `supabase/migrations/0022_cra_projects.sql`

**Interfaces:**
- Produces: DB columns `cra_projects.actual_cost/target_date/fiscal_year_id/category/priority`, integer money columns, `cra_quotes.contact_*/is_selected`, `cra_updates.created_by`, the `is_cra_editor()` SQL function, and full insert/update/delete RLS policies.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0022_cra_projects.sql`:

```sql
-- CRA Projects: execution-tracker columns, integer-cents money, authorship fix,
-- and RLS that lets the CRA chair (position name = 'cra') manage CRA data.
-- PRECONDITION: cra_projects / cra_quotes / cra_updates / cra_documents are EMPTY.

-- ─── Money: dollars(numeric) → integer cents ────────────────────────────────
alter table cra_projects alter column estimated_cost type integer using (estimated_cost * 100)::integer;
alter table cra_quotes    alter column amount         type integer using (amount * 100)::integer;

-- ─── cra_projects: new execution-tracker columns ────────────────────────────
alter table cra_projects add column actual_cost    integer;
alter table cra_projects add column target_date     date;
alter table cra_projects add column fiscal_year_id  uuid references fiscal_years(id);
alter table cra_projects add column category        text;
alter table cra_projects add column priority        text check (priority in ('high','medium','low'));

-- ─── cra_quotes: contact card + selected-vendor flag ────────────────────────
alter table cra_quotes add column contact_name  text;
alter table cra_quotes add column contact_phone text;
alter table cra_quotes add column contact_email text;
alter table cra_quotes add column is_selected   boolean not null default false;

-- ─── cra_updates: authorship as a positions FK (old check excluded 'cra') ────
alter table cra_updates drop column created_by_position;   -- drops its check constraint too
alter table cra_updates add  column created_by uuid not null references positions(id);

-- ─── Editor helper: president/officer OR the CRA chair position ──────────────
create or replace function is_cra_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
      and (role in ('president','officer') or name = 'cra')
  );
$$;

-- ─── Replace officer-only write policies; add the missing delete/update ones ─
drop policy if exists "cra_projects_insert" on cra_projects;
drop policy if exists "cra_projects_update" on cra_projects;
drop policy if exists "cra_quotes_insert"   on cra_quotes;
drop policy if exists "cra_updates_insert"  on cra_updates;
drop policy if exists "cra_docs_insert"     on cra_documents;

create policy "cra_projects_insert" on cra_projects for insert to authenticated with check (is_cra_editor());
create policy "cra_projects_update" on cra_projects for update to authenticated using (is_cra_editor());
create policy "cra_projects_delete" on cra_projects for delete to authenticated using (is_cra_editor());

create policy "cra_quotes_insert" on cra_quotes for insert to authenticated with check (is_cra_editor());
create policy "cra_quotes_update" on cra_quotes for update to authenticated using (is_cra_editor());
create policy "cra_quotes_delete" on cra_quotes for delete to authenticated using (is_cra_editor());

create policy "cra_updates_insert" on cra_updates for insert to authenticated with check (is_cra_editor());

create policy "cra_docs_insert" on cra_documents for insert to authenticated with check (is_cra_editor());
create policy "cra_docs_delete" on cra_documents for delete to authenticated using (is_cra_editor());
```

- [ ] **Step 2: Sanity-check the SQL**

Run: `grep -c "create policy" supabase/migrations/0022_cra_projects.sql`
Expected: `8`

- [ ] **Step 3: Commit** (the migration is applied manually in Supabase later — see Task 15)

```bash
git add supabase/migrations/0022_cra_projects.sql
git commit -m "feat(cra): migration 0022 — execution-tracker columns, integer cents, CRA-chair RLS"
```

---

### Task 2: Database & domain types

**Files:**
- Modify: `types/database.ts` (cra_* table types ~106-199; add `CRAPriority` near `CRAProjectStatus` ~815)
- Modify: `types/domain.ts` (`CRAProjectDetail`)

**Interfaces:**
- Produces: `CRAPriority` union; updated `CRAProject`/`CRAQuote`/`CRAUpdate` Row/Insert/Update types; `CRAProjectDetail` unchanged shape but verified.

- [ ] **Step 1: Add the `CRAPriority` union**

In `types/database.ts`, immediately after the `CRAProjectStatus` union (ends ~line 820), add:

```ts
export type CRAPriority = "high" | "medium" | "low";
```

- [ ] **Step 2: Replace the `cra_projects` table type** (lines ~106-136) with:

```ts
      cra_projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: CRAProjectStatus;
          estimated_cost: number | null;
          actual_cost: number | null;
          target_date: string | null;
          fiscal_year_id: string | null;
          category: string | null;
          priority: CRAPriority | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: CRAProjectStatus;
          estimated_cost?: number | null;
          actual_cost?: number | null;
          target_date?: string | null;
          fiscal_year_id?: string | null;
          category?: string | null;
          priority?: CRAPriority | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: CRAProjectStatus;
          estimated_cost?: number | null;
          actual_cost?: number | null;
          target_date?: string | null;
          fiscal_year_id?: string | null;
          category?: string | null;
          priority?: CRAPriority | null;
          updated_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Replace the `cra_quotes` table type** (lines ~137-161) with:

```ts
      cra_quotes: {
        Row: {
          id: string;
          project_id: string;
          vendor_name: string;
          amount: number;
          notes: string | null;
          document_url: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          is_selected: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          vendor_name: string;
          amount: number;
          notes?: string | null;
          document_url?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          is_selected?: boolean;
          created_at?: string;
        };
        Update: {
          vendor_name?: string;
          amount?: number;
          notes?: string | null;
          document_url?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          is_selected?: boolean;
        };
        Relationships: [];
      };
```

- [ ] **Step 4: Replace the `cra_updates` table type** (lines ~162-179) with:

```ts
      cra_updates: {
        Row: {
          id: string;
          project_id: string;
          content: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          content: string;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
```

- [ ] **Step 5: Verify `CRAProjectDetail`** in `types/domain.ts` still compiles (it spreads `CRAProject` + arrays — no change needed). Confirm it reads:

```ts
export interface CRAProjectDetail extends CRAProject {
  quotes: CRAQuote[];
  updates: CRAUpdate[];
  documents: CRADocument[];
}
```

- [ ] **Step 6: Type-check**

Run: `pnpm type-check`
Expected: PASS (no references to `created_by_position` remain; new columns resolve).

- [ ] **Step 7: Commit**

```bash
git add types/database.ts types/domain.ts
git commit -m "feat(cra): types for new columns, CRAPriority, integer-cents money"
```

---

### Task 3: `canEditCRA` signature change (TDD)

**Files:**
- Modify: `lib/permissions.test.ts` (the `canEditCRA` describe block, lines ~46-57)
- Modify: `lib/permissions.ts` (lines ~42-49)

**Interfaces:**
- Produces: `canEditCRA(role: PositionRole, positionName: PositionName): boolean`

- [ ] **Step 1: Update the failing tests**

Replace the `canEditCRA` describe block in `lib/permissions.test.ts` with:

```ts
describe("canEditCRA", () => {
  it("allows president and officer to edit CRA", () => {
    expect(canEditCRA("president", "president")).toBe(true);
    expect(canEditCRA("officer", "vp")).toBe(true);
  });

  it("allows the CRA chair position regardless of chair role", () => {
    expect(canEditCRA("chair", "cra")).toBe(true);
  });

  it("prevents members from editing CRA", () => {
    expect(canEditCRA("member", "pool")).toBe(false);
  });

  it("prevents non-CRA chairs from editing CRA", () => {
    expect(canEditCRA("chair", "architecture")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test lib/permissions.test.ts`
Expected: FAIL (arity error / `canEditCRA("chair","cra")` is false under old impl).

- [ ] **Step 3: Update the implementation**

In `lib/permissions.ts`, replace `canEditCRA`:

```ts
/**
 * Returns true if the user can edit CRA project data.
 * President and officers can edit any section; the CRA committee chair
 * (position name 'cra') can edit CRA data despite the chair role.
 *
 * @param role         - The current user's position role
 * @param positionName - The current user's position name
 */
export const canEditCRA = (
  role: PositionRole,
  positionName: PositionName
): boolean => canEditAll(role) || positionName === "cra";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test lib/permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat(cra): canEditCRA grants the CRA chair edit access"
```

---

### Task 4: Money helpers (TDD)

**Files:**
- Create: `lib/money.ts`
- Test: `lib/money.test.ts`

**Interfaces:**
- Produces: `parseDollarsToCents(input: string): number | null`, `formatCents(cents: number): string`. Used by every CRA form (parse) and display (format).

- [ ] **Step 1: Write the failing test**

Create `lib/money.test.ts`:

```ts
import { parseDollarsToCents, formatCents } from "./money";

describe("parseDollarsToCents", () => {
  it("converts plain dollars to cents", () => {
    expect(parseDollarsToCents("100")).toBe(10000);
  });
  it("handles decimals", () => {
    expect(parseDollarsToCents("14181.50")).toBe(1418150);
  });
  it("strips $ and commas", () => {
    expect(parseDollarsToCents("$1,250.00")).toBe(125000);
  });
  it("returns null for empty or non-numeric", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats whole dollars", () => {
    expect(formatCents(22549700)).toBe("$225,497");
  });
  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test lib/money.test.ts`
Expected: FAIL ("Cannot find module './money'").

- [ ] **Step 3: Implement**

Create `lib/money.ts`:

```ts
/**
 * Parses a user-entered dollar string into integer cents.
 * Strips leading "$" and thousands separators. Returns null when the input
 * is empty or not a number, so callers can distinguish "unset" from 0.
 *
 * @param input - Dollar string such as "1,250.00" or "$100"
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Formats integer cents as a whole-dollar USD string, e.g. 22549700 → "$225,497".
 *
 * @param cents - Amount in integer cents
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test lib/money.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts
git commit -m "feat: shared dollars/cents money helpers"
```

---

### Task 5: CRA pure helpers (TDD)

**Files:**
- Create: `lib/cra/projects.ts`
- Test: `lib/cra/projects.test.ts`

**Interfaces:**
- Produces:
  - `OPEN_STATUSES: CRAProjectStatus[]` = `["proposed","approved","in_progress","on_hold"]`
  - `isOpenStatus(s: CRAProjectStatus): boolean`
  - `compareProjects(a, b): number` — sort comparator (priority desc, then target_date asc nulls-last, on_hold sinks)
  - `quoteReadiness(count: number): { count: number; required: 3; met: boolean }`
  - `sumEstimated(projects): number`, `sumActual(projects): number`
- Consumes: `CRAProject`, `CRAProjectStatus`, `CRAPriority` from `@/types/database`.

- [ ] **Step 1: Write the failing test**

Create `lib/cra/projects.test.ts`:

```ts
import {
  OPEN_STATUSES,
  isOpenStatus,
  compareProjects,
  quoteReadiness,
  sumEstimated,
  sumActual,
} from "./projects";
import type { CRAProject } from "@/types/database";

function project(p: Partial<CRAProject>): CRAProject {
  return {
    id: "x", name: "P", description: null, status: "proposed",
    estimated_cost: 0, actual_cost: null, target_date: null,
    fiscal_year_id: null, category: null, priority: null,
    created_by: "u", created_at: "", updated_at: "", ...p,
  };
}

describe("OPEN_STATUSES", () => {
  it("includes on_hold but not complete", () => {
    expect(OPEN_STATUSES).toContain("on_hold");
    expect(OPEN_STATUSES).not.toContain("complete");
  });
});

describe("isOpenStatus", () => {
  it("is false only for complete", () => {
    expect(isOpenStatus("complete")).toBe(false);
    expect(isOpenStatus("on_hold")).toBe(true);
  });
});

describe("compareProjects", () => {
  it("sorts high priority before low", () => {
    const arr = [project({ priority: "low" }), project({ priority: "high" })];
    arr.sort(compareProjects);
    expect(arr[0].priority).toBe("high");
  });
  it("sorts by target_date asc within equal priority, nulls last", () => {
    const arr = [
      project({ priority: "high", target_date: null }),
      project({ priority: "high", target_date: "2026-09-01" }),
    ];
    arr.sort(compareProjects);
    expect(arr[0].target_date).toBe("2026-09-01");
  });
  it("sinks on_hold below other open statuses of equal priority", () => {
    const arr = [
      project({ priority: "high", status: "on_hold" }),
      project({ priority: "high", status: "in_progress" }),
    ];
    arr.sort(compareProjects);
    expect(arr[0].status).toBe("in_progress");
  });
});

describe("quoteReadiness", () => {
  it("is unmet below 3 and met at 3", () => {
    expect(quoteReadiness(2).met).toBe(false);
    expect(quoteReadiness(3).met).toBe(true);
  });
});

describe("sumEstimated / sumActual", () => {
  it("sums estimated cents, treating null as 0", () => {
    expect(sumEstimated([project({ estimated_cost: 1000 }), project({ estimated_cost: null })])).toBe(1000);
  });
  it("sums actual cents, treating null as 0", () => {
    expect(sumActual([project({ actual_cost: 500 }), project({ actual_cost: null })])).toBe(500);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test lib/cra/projects.test.ts`
Expected: FAIL ("Cannot find module './projects'").

- [ ] **Step 3: Implement**

Create `lib/cra/projects.ts`:

```ts
import type { CRAProject, CRAProjectStatus, CRAPriority } from "@/types/database";

/** Statuses shown on the "Open" tab and counted as active on the dashboard. */
export const OPEN_STATUSES: CRAProjectStatus[] = [
  "proposed",
  "approved",
  "in_progress",
  "on_hold",
];

/** Number of quotes the HOA bylaws require per project. */
export const REQUIRED_QUOTES = 3 as const;

/**
 * Returns true if the status belongs to the Open tab (everything except complete).
 * @param status - A CRA project status
 */
export function isOpenStatus(status: CRAProjectStatus): boolean {
  return status !== "complete";
}

const PRIORITY_RANK: Record<CRAPriority, number> = { high: 0, medium: 1, low: 2 };

/** Rank for sorting; null priority sorts after all explicit priorities. */
function priorityRank(p: CRAPriority | null): number {
  return p === null ? 3 : PRIORITY_RANK[p];
}

/**
 * Default list comparator for the Open tab: priority high→low (null last),
 * then on_hold sinks below other open statuses, then target_date ascending
 * (null last). Pure — pass directly to Array.prototype.sort.
 *
 * @param a - First project
 * @param b - Second project
 */
export function compareProjects(a: CRAProject, b: CRAProject): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;

  const aHold = a.status === "on_hold" ? 1 : 0;
  const bHold = b.status === "on_hold" ? 1 : 0;
  if (aHold !== bHold) return aHold - bHold;

  const aDate = a.target_date ?? "9999-12-31";
  const bDate = b.target_date ?? "9999-12-31";
  return aDate.localeCompare(bDate);
}

/**
 * Computes quote readiness against the 3-quote requirement.
 * @param count - Number of quotes attached to the project
 */
export function quoteReadiness(count: number): {
  count: number;
  required: typeof REQUIRED_QUOTES;
  met: boolean;
} {
  return { count, required: REQUIRED_QUOTES, met: count >= REQUIRED_QUOTES };
}

/** Sums estimated_cost (cents) across projects, treating null as 0. */
export function sumEstimated(projects: Pick<CRAProject, "estimated_cost">[]): number {
  return projects.reduce((s, p) => s + (p.estimated_cost ?? 0), 0);
}

/** Sums actual_cost (cents) across projects, treating null as 0. */
export function sumActual(projects: Pick<CRAProject, "actual_cost">[]): number {
  return projects.reduce((s, p) => s + (p.actual_cost ?? 0), 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test lib/cra/projects.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/cra/projects.ts lib/cra/projects.test.ts
git commit -m "feat(cra): pure helpers — OPEN_STATUSES, sort comparator, totals, readiness"
```

---

### Task 6: Server actions `actions/cra.ts`

**Files:**
- Create: `actions/cra.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, types from `@/types/database`.
- Produces these server actions (all `"use server"`), used by the page/client components in later tasks:
  - `createCRAProject(input: CreateProjectInput): Promise<{ id: string }>`
  - `updateCRAProject(id: string, patch: Database["public"]["Tables"]["cra_projects"]["Update"]): Promise<void>`
  - `deleteCRAProject(id: string): Promise<void>`
  - `addQuote(input: AddQuoteInput): Promise<void>`
  - `updateQuote(id: string, patch: Database["public"]["Tables"]["cra_quotes"]["Update"]): Promise<void>`
  - `deleteQuote(id: string): Promise<void>`
  - `selectQuote(projectId: string, quoteId: string): Promise<void>`
  - `addUpdate(projectId: string, content: string): Promise<void>`
  - `addCRADocument(projectId: string, name: string, url: string, urlType: DocumentUrlType): Promise<void>`
  - `deleteCRADocument(id: string): Promise<void>`

> Note: server actions are thin wrappers over RLS-enforced Supabase calls; the repo does not unit-test them (RLS can't run in Jest). Verification for this task is `pnpm type-check`. Pure logic lives in Task 5.

- [ ] **Step 1: Implement the actions**

Create `actions/cra.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Database,
  CRAProjectStatus,
  CRAPriority,
  DocumentUrlType,
} from "@/types/database";

interface CreateProjectInput {
  name: string;
  estimatedCost: number; // cents
  description?: string | null;
  category?: string | null;
  priority?: CRAPriority | null;
  targetDate?: string | null;
  fiscalYearId?: string | null;
  status?: CRAProjectStatus;
}

interface AddQuoteInput {
  projectId: string;
  vendorName: string;
  amount: number; // cents
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
}

/** Resolves the current user's position id, or throws if unauthenticated. */
async function currentPositionId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("positions")
    .select("id")
    .eq("email", user.email)
    .single();
  if (!data) throw new Error("No position for current user");
  return data.id;
}

/**
 * Creates a CRA project owned by the current user's position.
 * RLS rejects the insert unless the caller is a CRA editor.
 * @param input - Project fields; estimatedCost is integer cents
 * @returns The new project's id
 */
export async function createCRAProject(
  input: CreateProjectInput
): Promise<{ id: string }> {
  const supabase = await createClient();
  const createdBy = await currentPositionId(supabase);

  const { data, error } = await supabase
    .from("cra_projects")
    .insert({
      name: input.name.trim(),
      estimated_cost: input.estimatedCost,
      description: input.description ?? null,
      category: input.category ?? null,
      priority: input.priority ?? null,
      target_date: input.targetDate ?? null,
      fiscal_year_id: input.fiscalYearId ?? null,
      status: input.status ?? "proposed",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/cra");
  return { id: data.id };
}

/**
 * Patches a CRA project's editable fields. RLS enforces CRA-editor access.
 * @param id    - Project UUID
 * @param patch - Partial cra_projects Update
 */
export async function updateCRAProject(
  id: string,
  patch: Database["public"]["Tables"]["cra_projects"]["Update"]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra");
  revalidatePath(`/cra/${id}`);
}

/**
 * Deletes a CRA project (cascades to quotes/updates/documents via FK).
 * RLS enforces CRA-editor access.
 * @param id - Project UUID
 */
export async function deleteCRAProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra");
}

/**
 * Adds a vendor quote to a project. amount is integer cents.
 * @param input - Quote fields
 */
export async function addQuote(input: AddQuoteInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").insert({
    project_id: input.projectId,
    vendor_name: input.vendorName.trim(),
    amount: input.amount,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null,
    notes: input.notes ?? null,
    document_url: input.documentUrl ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${input.projectId}`);
}

/**
 * Patches a quote's fields. RLS enforces CRA-editor access.
 * @param id    - Quote UUID
 * @param patch - Partial cra_quotes Update
 */
export async function updateQuote(
  id: string,
  patch: Database["public"]["Tables"]["cra_quotes"]["Update"]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}

/**
 * Deletes a quote.
 * @param id - Quote UUID
 */
export async function deleteQuote(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}

/**
 * Marks one quote as the selected vendor and clears the others on the project.
 * Two ordered writes: clear all on the project, then set the chosen one.
 * Action-level enforcement is sufficient for a single-editor HOA board.
 * @param projectId - Project UUID
 * @param quoteId   - Quote UUID to select
 */
export async function selectQuote(
  projectId: string,
  quoteId: string
): Promise<void> {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("cra_quotes")
    .update({ is_selected: false })
    .eq("project_id", projectId);
  if (clearError) throw new Error(clearError.message);

  const { error: setError } = await supabase
    .from("cra_quotes")
    .update({ is_selected: true })
    .eq("id", quoteId);
  if (setError) throw new Error(setError.message);

  revalidatePath(`/cra/${projectId}`);
}

/**
 * Appends an immutable status update authored by the current user's position.
 * @param projectId - Project UUID
 * @param content   - Update text
 */
export async function addUpdate(
  projectId: string,
  content: string
): Promise<void> {
  if (!content.trim()) return;
  const supabase = await createClient();
  const createdBy = await currentPositionId(supabase);

  const { error } = await supabase.from("cra_updates").insert({
    project_id: projectId,
    content: content.trim(),
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${projectId}`);
}

/**
 * Links a document (uploaded storage path or pasted URL) to a project.
 * @param projectId - Project UUID
 * @param name      - Display name
 * @param url       - Storage path or external URL
 * @param urlType   - 'storage_file' or 'google_doc'
 */
export async function addCRADocument(
  projectId: string,
  name: string,
  url: string,
  urlType: DocumentUrlType
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_documents").insert({
    project_id: projectId,
    name: name.trim(),
    url,
    url_type: urlType,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${projectId}`);
}

/**
 * Removes a document link from a project (DB row only; storage cleanup
 * is out of scope for v1 — orphaned files are harmless in the private bucket).
 * @param id - Document UUID
 */
export async function deleteCRADocument(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add actions/cra.ts
git commit -m "feat(cra): server actions for projects, quotes, updates, documents"
```

---

### Task 7: `CRAProjectCard` component

**Files:**
- Create: `components/hoa/CRAProjectCard.tsx`
- Test: `components/hoa/CRAProjectCard.test.tsx`
- Modify: `components/hoa/index.ts` (export it)

**Interfaces:**
- Consumes: `CRAProject` + `quoteCount`, `formatCents`, `quoteReadiness`, `StatusBadge`.
- Produces: `<CRAProjectCard project={...} quoteCount={n} />` — a clickable card linking to `/cra/[id]`.

- [ ] **Step 1: Write the failing test**

Create `components/hoa/CRAProjectCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { CRAProjectCard } from "./CRAProjectCard";
import type { CRAProject } from "@/types/database";

const base: CRAProject = {
  id: "p1", name: "Toe Drain", description: null, status: "proposed",
  estimated_cost: 10000000, actual_cost: null, target_date: null,
  fiscal_year_id: null, category: "Lake Maintenance", priority: "high",
  created_by: "u", created_at: "", updated_at: "",
};

describe("CRAProjectCard", () => {
  it("shows name, formatted estimate, category, and quote readiness", () => {
    render(<CRAProjectCard project={base} quoteCount={2} />);
    expect(screen.getByText("Toe Drain")).toBeInTheDocument();
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getByText("Lake Maintenance")).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 quotes/i)).toBeInTheDocument();
  });

  it("links to the project detail page", () => {
    render(<CRAProjectCard project={base} quoteCount={0} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/cra/p1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/hoa/CRAProjectCard.test.tsx`
Expected: FAIL ("Cannot find module './CRAProjectCard'").

- [ ] **Step 3: Implement**

Create `components/hoa/CRAProjectCard.tsx`:

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { formatCents } from "@/lib/money";
import { quoteReadiness } from "@/lib/cra/projects";
import type { CRAProject } from "@/types/database";

interface CRAProjectCardProps {
  /** The project to render */
  project: CRAProject;
  /** Number of quotes attached, for the X-of-3 readiness pill */
  quoteCount: number;
}

/** Formats an ISO date (YYYY-MM-DD) as a short human date, or "" if null. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Clickable summary card for a CRA project in the list view.
 * Shows name, status, category, priority, estimated (and actual) cost,
 * target date with an overdue cue, and 3-quote readiness.
 *
 * @param project    - The project to display
 * @param quoteCount - Attached quote count for the readiness indicator
 */
export function CRAProjectCard({ project, quoteCount }: CRAProjectCardProps) {
  const readiness = quoteReadiness(quoteCount);
  const overdue =
    project.target_date !== null &&
    project.status !== "complete" &&
    project.target_date < new Date().toISOString().slice(0, 10);

  return (
    <Link href={`/cra/${project.id}`} className="block">
      <Card className="p-4 transition-colors hover:bg-accent/40">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium">{project.name}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {project.category && (
                <span className="rounded bg-muted px-1.5 py-0.5">{project.category}</span>
              )}
              {project.priority && (
                <span className="capitalize">{project.priority} priority</span>
              )}
              {project.target_date && (
                <span className={overdue ? "text-destructive font-medium" : ""}>
                  Due {shortDate(project.target_date)}{overdue ? " · overdue" : ""}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span>
            Est. {formatCents(project.estimated_cost ?? 0)}
            {project.actual_cost !== null && (
              <span className="text-muted-foreground"> · Actual {formatCents(project.actual_cost)}</span>
            )}
          </span>
          <span className={readiness.met ? "text-green-600" : "text-amber-600"}>
            {readiness.count} of {readiness.required} quotes
          </span>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: Verify `StatusBadge` accepts CRA statuses**

Run: `grep -n "in_progress\|on_hold\|proposed" components/hoa/StatusBadge.tsx`
Expected: matches present (StatusBadge already maps all CRA statuses). If a CRA status is missing, add it to StatusBadge's status map following the existing entries.

- [ ] **Step 5: Export it**

In `components/hoa/index.ts`, add (alphabetically near other exports):

```ts
export { CRAProjectCard } from "./CRAProjectCard";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test components/hoa/CRAProjectCard.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/hoa/CRAProjectCard.tsx components/hoa/CRAProjectCard.test.tsx components/hoa/index.ts
git commit -m "feat(cra): CRAProjectCard list card"
```

---

### Task 8: `/cra` list page — tabs, summary, filters

**Files:**
- Create: `components/hoa/CRAProjectList.tsx` (client — tabs + filter state)
- Modify: `app/(dashboard)/cra/page.tsx` (rebuild from stub)

**Interfaces:**
- Consumes: `createClient`, `canEditCRA`, `compareProjects`, `OPEN_STATUSES`, `sumEstimated`, `sumActual`, `formatCents`, `CRAProjectCard`.
- Produces: the working `/cra` list. `CRAProjectList` receives `projects`, `quoteCounts: Record<string, number>`, `fiscalYears`, and `canEdit`.

- [ ] **Step 1: Build the client list component**

Create `components/hoa/CRAProjectList.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { CRAProjectCard } from "@/components/hoa/CRAProjectCard";
import { compareProjects, isOpenStatus, sumEstimated, sumActual } from "@/lib/cra/projects";
import { formatCents } from "@/lib/money";
import { EmptyState } from "@/components/hoa/EmptyState";
import type { CRAProject } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectListProps {
  projects: CRAProject[];
  quoteCounts: Record<string, number>;
  fiscalYears: FiscalYearOption[];
}

/**
 * Client list for /cra: Open/Complete tabs, fiscal-year filter, and a totals
 * summary bar. Sorting and totals use the pure helpers from lib/cra/projects.
 *
 * @param projects    - All CRA projects (any fiscal year)
 * @param quoteCounts - Map of project id → attached quote count
 * @param fiscalYears - Options for the fiscal-year filter (most-recent first)
 */
export function CRAProjectList({ projects, quoteCounts, fiscalYears }: CRAProjectListProps) {
  const [tab, setTab] = useState<"open" | "complete">("open");
  const [fyId, setFyId] = useState<string>("all");

  const visible = useMemo(() => {
    return projects
      .filter((p) => (tab === "open" ? isOpenStatus(p.status) : p.status === "complete"))
      .filter((p) => (fyId === "all" ? true : p.fiscal_year_id === fyId))
      .sort(compareProjects);
  }, [projects, tab, fyId]);

  const estTotal = sumEstimated(visible);
  const actTotal = sumActual(visible);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(["open", "complete"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                tab === t ? "bg-accent font-medium" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <select
          value={fyId}
          onChange={(e) => setFyId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by fiscal year"
        >
          <option value="all">All fiscal years</option>
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>{fy.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
        {visible.length} project{visible.length === 1 ? "" : "s"} ·{" "}
        <span className="font-medium">{formatCents(estTotal)}</span> budgeted
        {actTotal > 0 && <> · <span className="font-medium">{formatCents(actTotal)}</span> spent</>}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No projects here"
          description={tab === "open" ? "No open projects for this filter." : "No completed projects yet."}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <CRAProjectCard key={p.id} project={p} quoteCount={quoteCounts[p.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rebuild the page**

Replace `app/(dashboard)/cra/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CRAProjectList } from "@/components/hoa/CRAProjectList";
import { Button } from "@/components/ui/button";
import type { CRAProject } from "@/types/database";

export const metadata = { title: "CRA Projects — HOA Board" };

/** Capital Reserve Analysis project list — Open/Complete tabs with totals. */
export default async function CRAPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions").select("id, name, role").eq("email", user.email!).single();
  if (!position) redirect("/login");
  // Chairs are restricted — except the CRA chair, who owns this page.
  if (isChair(position.role) && position.name !== "cra") {
    redirect(`/committee/${position.name}`);
  }

  const [projectsRes, quotesRes, fyRes] = await Promise.all([
    supabase.from("cra_projects").select("*"),
    supabase.from("cra_quotes").select("project_id"),
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
  ]);

  const projects = (projectsRes.data ?? []) as CRAProject[];
  const quoteRows = quotesRes.data ?? [];
  const fiscalYears = fyRes.data ?? [];

  const quoteCounts: Record<string, number> = {};
  for (const q of quoteRows) {
    quoteCounts[q.project_id] = (quoteCounts[q.project_id] ?? 0) + 1;
  }

  const canEdit = canEditCRA(position.role, position.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital Reserves Analysis"
        subtitle="Track ongoing capital improvement projects"
        action={
          canEdit ? (
            <Button nativeButton={false} render={<Link href="/cra/new" />}>New Project</Button>
          ) : undefined
        }
      />
      <CRAProjectList projects={projects} quoteCounts={quoteCounts} fiscalYears={fiscalYears} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and run the existing suite**

Run: `pnpm type-check && pnpm test --ci`
Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/cra/page.tsx components/hoa/CRAProjectList.tsx
git commit -m "feat(cra): /cra list with Open/Complete tabs, FY filter, totals"
```

---

### Task 9: `/cra/new` — create form

**Files:**
- Create: `components/hoa/CRAProjectForm.tsx` (client)
- Modify: `app/(dashboard)/cra/new/page.tsx` (rebuild from stub)

**Interfaces:**
- Consumes: `createCRAProject`, `parseDollarsToCents`, `FormField`.
- Produces: working create flow. `CRAProjectForm` receives `fiscalYears`, `defaultFiscalYearId`, `existingCategories`, `hoaName`.

- [ ] **Step 1: Build the form**

Create `components/hoa/CRAProjectForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCRAProject } from "@/actions/cra";
import { parseDollarsToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/hoa/FormField";
import type { CRAPriority } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectFormProps {
  fiscalYears: FiscalYearOption[];
  defaultFiscalYearId: string | null;
  existingCategories: string[];
  hoaName: string;
}

/**
 * Create-project form. Name + estimated cost (dollars) are required; the
 * estimate is converted to integer cents on submit. Category uses a datalist
 * of existing values. On success, navigates to the new project's detail page.
 *
 * @param fiscalYears         - Fiscal-year options (most-recent first)
 * @param defaultFiscalYearId - Pre-selected fiscal year, or null
 * @param existingCategories  - Distinct categories already in use (datalist)
 * @param hoaName             - HOA name for the reserve-study helper text
 */
export function CRAProjectForm({
  fiscalYears, defaultFiscalYearId, existingCategories, hoaName,
}: CRAProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<CRAPriority | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState(defaultFiscalYearId ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    const cents = parseDollarsToCents(estimate);
    if (cents === null) { setError("Enter a valid estimated cost."); return; }

    startTransition(async () => {
      try {
        const { id } = await createCRAProject({
          name,
          estimatedCost: cents,
          description: description.trim() || null,
          category: category.trim() || null,
          priority: priority || null,
          targetDate: targetDate || null,
          fiscalYearId: fiscalYearId || null,
        });
        router.push(`/cra/${id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create project.");
      }
    });
  };

  const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <FormField htmlFor="cra-name" label="Name" required>
        <input id="cra-name" className={input} value={name}
          onChange={(e) => setName(e.target.value)} disabled={isPending} />
      </FormField>

      <FormField htmlFor="cra-estimate" label="Estimated cost (USD)" required
        hint={`Refer to the Updated Capital Reserve Analysis for ${hoaName} for the initial estimate.`}>
        <input id="cra-estimate" className={input} inputMode="decimal" placeholder="100000"
          value={estimate} onChange={(e) => setEstimate(e.target.value)} disabled={isPending} />
      </FormField>

      <FormField htmlFor="cra-category" label="Category">
        <input id="cra-category" className={input} list="cra-categories"
          value={category} onChange={(e) => setCategory(e.target.value)} disabled={isPending} />
        <datalist id="cra-categories">
          {existingCategories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </FormField>

      <FormField htmlFor="cra-priority" label="Priority">
        <select id="cra-priority" className={input} value={priority} disabled={isPending}
          onChange={(e) => setPriority(e.target.value as CRAPriority | "")}>
          <option value="">None</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </FormField>

      <FormField htmlFor="cra-target" label="Target date">
        <input id="cra-target" type="date" className={input}
          value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={isPending} />
      </FormField>

      <FormField htmlFor="cra-fy" label="Fiscal year">
        <select id="cra-fy" className={input} value={fiscalYearId} disabled={isPending}
          onChange={(e) => setFiscalYearId(e.target.value)}>
          <option value="">Unassigned</option>
          {fiscalYears.map((fy) => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
        </select>
      </FormField>

      <FormField htmlFor="cra-desc" label="Description">
        <textarea id="cra-desc" className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
          value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} />
      </FormField>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
```

> **Check `FormField`'s API first.** Run `grep -n "interface FormFieldProps\|hint\|required" components/hoa/FormField.tsx`. If `FormField` doesn't support `hint`/`required` props, render the hint as a `<p className="text-xs text-muted-foreground">` below the input and mark required with a `*` in the label instead.

- [ ] **Step 2: Rebuild the page**

Replace `app/(dashboard)/cra/new/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CRAProjectForm } from "@/components/hoa/CRAProjectForm";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New CRA Project — HOA Board" };

/** Create a new CRA project — officers and the CRA chair only. */
export default async function NewCRAProjectPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions").select("id, name, role").eq("email", user.email!).single();
  if (!position) redirect("/login");
  if (!canEditCRA(position.role, position.name)) redirect("/cra");

  const [fyRes, catRes, hoaRes] = await Promise.all([
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
    supabase.from("cra_projects").select("category"),
    supabase.from("settings").select("value").eq("key", "hoa_name").single(),
  ]);

  const fiscalYears = fyRes.data ?? [];
  const existingCategories = Array.from(
    new Set((catRes.data ?? []).map((r) => r.category).filter((c): c is string => !!c))
  ).sort();
  const hoaName = hoaRes.data?.value ?? "your HOA";
  const defaultFiscalYearId = fiscalYears[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New CRA Project"
        subtitle="Add a new capital improvement project"
        action={<Button variant="outline" nativeButton={false} render={<Link href="/cra" />}>Cancel</Button>}
      />
      <CRAProjectForm
        fiscalYears={fiscalYears}
        defaultFiscalYearId={defaultFiscalYearId}
        existingCategories={existingCategories}
        hoaName={hoaName}
      />
    </div>
  );
}
```

> **Verify the settings key.** Run `grep -rn "hoa_name" supabase/migrations actions/settings.ts` to confirm the settings row uses `key='hoa_name'` and a `value` column. Adjust the `.eq("key", …)`/`.select("value")` if the column names differ.

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/cra/new/page.tsx components/hoa/CRAProjectForm.tsx
git commit -m "feat(cra): /cra/new create form with reserve-study helper text"
```

---

### Task 10: `/cra/[id]` detail page + header inline edit

**Files:**
- Create: `app/(dashboard)/cra/[id]/page.tsx`
- Create: `components/hoa/CRAProjectHeader.tsx` (client — inline edit of status/costs/etc.)

**Interfaces:**
- Consumes: `createClient`, `canEditCRA`, `updateCRAProject`, `deleteCRAProject`, `formatCents`, `parseDollarsToCents`, `InlineConfirm`, `CRAProjectDetail`.
- Produces: the detail page shell that fetches a project with quotes/updates/documents and renders header + (Task 11) quotes + (Task 12) updates/documents.

- [ ] **Step 1: Build the detail page (Server Component)**

Create `app/(dashboard)/cra/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CRAProjectHeader } from "@/components/hoa/CRAProjectHeader";
import { CRAQuotesSection } from "@/components/hoa/CRAQuotesSection";
import { CRAUpdatesSection } from "@/components/hoa/CRAUpdatesSection";
import { CRADocumentsSection } from "@/components/hoa/CRADocumentsSection";
import type { CRAProject, CRAQuote, CRAUpdate, CRADocument } from "@/types/database";

export const metadata = { title: "CRA Project — HOA Board" };

/** CRA project detail — header, quotes, updates log, and documents. */
export default async function CRAProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions").select("id, name, role").eq("email", user.email!).single();
  if (!position) redirect("/login");
  if (isChair(position.role) && position.name !== "cra") {
    redirect(`/committee/${position.name}`);
  }

  const [projectRes, quotesRes, updatesRes, docsRes, fyRes] = await Promise.all([
    supabase.from("cra_projects").select("*").eq("id", id).single(),
    supabase.from("cra_quotes").select("*").eq("project_id", id).order("created_at"),
    supabase.from("cra_updates").select("*, positions:created_by(name)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("cra_documents").select("*").eq("project_id", id).order("created_at"),
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
  ]);

  const project = projectRes.data as CRAProject | null;
  if (!project) notFound();

  const quotes = (quotesRes.data ?? []) as CRAQuote[];
  const updates = (updatesRes.data ?? []) as (CRAUpdate & { positions: { name: string } | null })[];
  const documents = (docsRes.data ?? []) as CRADocument[];
  const fiscalYears = fyRes.data ?? [];

  const canEdit = canEditCRA(position.role, position.name);

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} subtitle="Capital improvement project" />

      <CRAProjectHeader project={project} fiscalYears={fiscalYears} canEdit={canEdit} />

      <SectionCard title="Quotes">
        <CRAQuotesSection projectId={project.id} quotes={quotes} canEdit={canEdit} />
      </SectionCard>

      <SectionCard title="Status updates">
        <CRAUpdatesSection projectId={project.id} updates={updates} canEdit={canEdit} />
      </SectionCard>

      <SectionCard title="Documents">
        <CRADocumentsSection
          projectId={project.id}
          documents={documents}
          positionId={position.id}
          canEdit={canEdit}
        />
      </SectionCard>
    </div>
  );
}
```

> The `select("*, positions:created_by(name)")` embed resolves the author name via the FK. If the Supabase relationship name differs, fall back to fetching positions separately and mapping by id. Verify with one query in the Supabase SQL editor during Task 15.

- [ ] **Step 2: Build the header client component**

Create `components/hoa/CRAProjectHeader.tsx`. Render read-only values for non-editors; for editors, a status `<select>` that calls `updateCRAProject(project.id, { status })`, click-to-edit fields for `estimated_cost`/`actual_cost` (dollars↔cents via `parseDollarsToCents`/`formatCents`), `target_date` (`<input type="date">`), `priority` (`<select>`), `category` (text), `fiscal_year_id` (`<select>` from `fiscalYears`), and a description `<textarea>`. Each field saves via `updateCRAProject` inside `useTransition`, then `router.refresh()`. Include a president-or-editor **Delete project** control using `InlineConfirm` that calls `deleteCRAProject(project.id)` then `router.push('/cra')`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCRAProject, deleteCRAProject } from "@/actions/cra";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Button } from "@/components/ui/button";
import type { CRAProject, CRAProjectStatus, CRAPriority } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectHeaderProps {
  project: CRAProject;
  fiscalYears: FiscalYearOption[];
  canEdit: boolean;
}

const STATUSES: CRAProjectStatus[] = ["proposed", "approved", "in_progress", "complete", "on_hold"];

/**
 * Inline-editable header for a CRA project. Editors get a status dropdown and
 * click-to-edit cost/date/priority/category/fiscal-year/description fields plus
 * a confirm-gated delete. Non-editors see read-only values.
 *
 * @param project     - The project to display/edit
 * @param fiscalYears - Fiscal-year options for the FY field
 * @param canEdit     - Whether the current user may edit (canEditCRA)
 */
export function CRAProjectHeader({ project, fiscalYears, canEdit }: CRAProjectHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (patch: Parameters<typeof updateCRAProject>[1]) =>
    startTransition(async () => {
      await updateCRAProject(project.id, patch);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      await deleteCRAProject(project.id);
      router.push("/cra");
    });

  if (!canEdit) {
    return (
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm sm:grid-cols-3">
        <Field label="Status" value={project.status} />
        <Field label="Estimated" value={formatCents(project.estimated_cost ?? 0)} />
        <Field label="Actual" value={project.actual_cost === null ? "—" : formatCents(project.actual_cost)} />
        <Field label="Priority" value={project.priority ?? "—"} />
        <Field label="Target date" value={project.target_date ?? "—"} />
        <Field label="Category" value={project.category ?? "—"} />
        {project.description && <Field label="Description" value={project.description} wide />}
      </dl>
    );
  }

  const input = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-4 rounded-md border border-border p-4 text-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <select className={`${input} w-full`} value={project.status} disabled={isPending}
            onChange={(e) => save({ status: e.target.value as CRAProjectStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <MoneyField label="Estimated" cents={project.estimated_cost}
          onSave={(c) => save({ estimated_cost: c })} disabled={isPending} />
        <MoneyField label="Actual" cents={project.actual_cost}
          onSave={(c) => save({ actual_cost: c })} disabled={isPending} />

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Priority</span>
          <select className={`${input} w-full`} value={project.priority ?? ""} disabled={isPending}
            onChange={(e) => save({ priority: (e.target.value || null) as CRAPriority | null })}>
            <option value="">None</option><option value="high">High</option>
            <option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Target date</span>
          <input type="date" className={`${input} w-full`} defaultValue={project.target_date ?? ""}
            disabled={isPending} onBlur={(e) => save({ target_date: e.target.value || null })} />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Fiscal year</span>
          <select className={`${input} w-full`} value={project.fiscal_year_id ?? ""} disabled={isPending}
            onChange={(e) => save({ fiscal_year_id: e.target.value || null })}>
            <option value="">Unassigned</option>
            {fiscalYears.map((fy) => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Category</span>
          <input className={`${input} w-full`} defaultValue={project.category ?? ""}
            disabled={isPending} onBlur={(e) => save({ category: e.target.value || null })} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Description</span>
        <textarea className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
          defaultValue={project.description ?? ""} disabled={isPending}
          onBlur={(e) => save({ description: e.target.value || null })} />
      </label>

      <div>
        {confirmDelete ? (
          <InlineConfirm message={`Delete "${project.name}" and all its quotes, updates, and documents?`}
            confirmLabel="Delete project" onConfirm={remove}
            onDismiss={() => setConfirmDelete(false)} isPending={isPending} />
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete project</Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}

/** Click-to-edit money field: shows formatted cents, edits as dollars. */
function MoneyField({ label, cents, onSave, disabled }: {
  label: string; cents: number | null; onSave: (cents: number | null) => void; disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button type="button" className="space-y-1 text-left" onClick={() => {
        setDraft(cents === null ? "" : String(cents / 100));
        setEditing(true);
      }}>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span>{cents === null ? "—" : formatCents(cents)}</span>
      </button>
    );
  }
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label} (USD)</span>
      <input autoFocus inputMode="decimal" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(parseDollarsToCents(draft)); }} />
    </label>
  );
}
```

- [ ] **Step 3: Type-check (will fail until Tasks 11-12 create the sections)**

Run: `pnpm type-check`
Expected: FAIL on missing `CRAQuotesSection`/`CRAUpdatesSection`/`CRADocumentsSection` imports — that's expected; Tasks 11-12 add them. Do not commit a broken type-check; either stub the three components now (return `null`) or implement Tasks 11-12 before committing. Recommended: create the three files as `export function X() { return null; }` placeholders now, commit, then flesh out.

- [ ] **Step 4: Create placeholder section components** so the page compiles:

Create `components/hoa/CRAQuotesSection.tsx`, `components/hoa/CRAUpdatesSection.tsx`, `components/hoa/CRADocumentsSection.tsx`, each:

```tsx
"use client";
export function CRAQuotesSection() { return null; } // fleshed out in Task 11
```

(Adjust the export name per file. Give each the props signature it will need so imports type-check — see Tasks 11-12 Interfaces.)

- [ ] **Step 5: Type-check + commit**

Run: `pnpm type-check`
Expected: PASS

```bash
git add app/\(dashboard\)/cra/\[id\]/page.tsx components/hoa/CRAProjectHeader.tsx components/hoa/CRAQuotesSection.tsx components/hoa/CRAUpdatesSection.tsx components/hoa/CRADocumentsSection.tsx
git commit -m "feat(cra): project detail page + inline-editable header"
```

---

### Task 11: Quotes section (add / edit / delete / select)

**Files:**
- Modify: `components/hoa/CRAQuotesSection.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `addQuote`, `updateQuote`, `deleteQuote`, `selectQuote`, `updateCRAProject`, `parseDollarsToCents`, `formatCents`, `InlineConfirm`, `quoteReadiness`.
- Props: `{ projectId: string; quotes: CRAQuote[]; canEdit: boolean }`.

- [ ] **Step 1: Implement the section**

Replace `components/hoa/CRAQuotesSection.tsx` with a client component that:
- Shows the "X of 3 quotes" readiness line via `quoteReadiness(quotes.length)`.
- Lists each quote: vendor, `formatCents(amount)`, contact name/phone/email, notes, a document link if `document_url`, a "Selected" badge when `is_selected`.
- For editors: a "Select" button per quote calling `selectQuote(projectId, quote.id)` then suggesting the actual cost (`updateCRAProject(projectId, { actual_cost: quote.amount })`) via a confirm; edit + delete (`InlineConfirm`) per quote; and an "Add quote" inline form mirroring `CRAProjectForm`'s field styling that calls `addQuote({...})` with `parseDollarsToCents` on the amount. After each mutation, `router.refresh()`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuote, deleteQuote, selectQuote, updateCRAProject } from "@/actions/cra";
import { parseDollarsToCents, formatCents } from "@/lib/money";
import { quoteReadiness } from "@/lib/cra/projects";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Button } from "@/components/ui/button";
import type { CRAQuote } from "@/types/database";

interface CRAQuotesSectionProps {
  projectId: string;
  quotes: CRAQuote[];
  canEdit: boolean;
}

const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Quotes list + add form for a CRA project. Shows 3-quote readiness, the
 * selected vendor, and (for editors) add/delete/select controls. Selecting a
 * quote offers to set the project's actual cost to that quote's amount.
 *
 * @param projectId - Owning project UUID
 * @param quotes    - Quotes attached to the project
 * @param canEdit   - Whether the current user may edit
 */
export function CRAQuotesSection({ projectId, quotes, canEdit }: CRAQuotesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const readiness = quoteReadiness(quotes.length);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = parseDollarsToCents(amount);
    if (!vendor.trim()) { setError("Vendor name is required."); return; }
    if (cents === null) { setError("Enter a valid amount."); return; }
    startTransition(async () => {
      await addQuote({
        projectId, vendorName: vendor, amount: cents,
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        notes: notes.trim() || null,
      });
      setVendor(""); setAmount(""); setContactName(""); setContactPhone("");
      setContactEmail(""); setNotes(""); setAdding(false);
      router.refresh();
    });
  };

  const choose = (quote: CRAQuote) =>
    startTransition(async () => {
      await selectQuote(projectId, quote.id);
      await updateCRAProject(projectId, { actual_cost: quote.amount });
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteQuote(id);
      setDeleteId(null);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <p className={readiness.met ? "text-sm text-green-600" : "text-sm text-amber-600"}>
        {readiness.count} of {readiness.required} quotes
      </p>

      <ul className="space-y-3">
        {quotes.map((q) => (
          <li key={q.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {q.vendor_name} · {formatCents(q.amount)}
                  {q.is_selected && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">Selected</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {[q.contact_name, q.contact_phone, q.contact_email].filter(Boolean).join(" · ")}
                </p>
                {q.notes && <p className="mt-1">{q.notes}</p>}
                {q.document_url && (
                  <a href={q.document_url} className="text-primary underline" target="_blank" rel="noreferrer">
                    Quote document
                  </a>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  {!q.is_selected && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => choose(q)}>Select</Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setDeleteId(q.id)}>Delete</Button>
                </div>
              )}
            </div>
            {deleteId === q.id && (
              <div className="mt-2">
                <InlineConfirm message="Delete this quote?" confirmLabel="Delete"
                  onConfirm={() => remove(q.id)} onDismiss={() => setDeleteId(null)} isPending={isPending} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add quote</Button>
      )}

      {canEdit && adding && (
        <form onSubmit={submitAdd} className="space-y-2 rounded-md border border-border p-3">
          <input className={input} placeholder="Vendor name" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={isPending} />
          <input className={input} inputMode="decimal" placeholder="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={isPending} />
          <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save quote"}</Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
```

> Edit-in-place of an existing quote's fields is deferred to a fast follow — v1 supports add, delete, and select (the common operations). To fix a typo, delete and re-add. (The `updateQuote` action exists for the fast follow.) If you want edit now, add an edit toggle per row mirroring the add form and call `updateQuote(q.id, patch)`.

- [ ] **Step 2: Type-check + commit**

Run: `pnpm type-check`
Expected: PASS

```bash
git add components/hoa/CRAQuotesSection.tsx
git commit -m "feat(cra): quotes section — add, delete, select vendor"
```

---

### Task 12: Updates log + documents sections

**Files:**
- Modify: `components/hoa/CRAUpdatesSection.tsx` (replace placeholder)
- Modify: `components/hoa/CRADocumentsSection.tsx` (replace placeholder)

**Interfaces:**
- `CRAUpdatesSection` props: `{ projectId: string; updates: (CRAUpdate & { positions: { name: string } | null })[]; canEdit: boolean }`.
- `CRADocumentsSection` props: `{ projectId: string; documents: CRADocument[]; positionId: string; canEdit: boolean }`.
- Consumes: `addUpdate`, `addCRADocument`, `deleteCRADocument`, `createClient` (browser, for storage upload), `FileUploadButton`, `InlineConfirm`.

- [ ] **Step 1: Implement the updates log**

Replace `components/hoa/CRAUpdatesSection.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUpdate } from "@/actions/cra";
import { Button } from "@/components/ui/button";
import type { CRAUpdate } from "@/types/database";

type UpdateRow = CRAUpdate & { positions: { name: string } | null };

interface CRAUpdatesSectionProps {
  projectId: string;
  updates: UpdateRow[];
  canEdit: boolean;
}

/**
 * Immutable, chronological status-update log for a CRA project, newest first.
 * Editors can append updates; existing entries are never edited or deleted.
 *
 * @param projectId - Owning project UUID
 * @param updates   - Update rows with embedded author position name
 * @param canEdit   - Whether the current user may add updates
 */
export function CRAUpdatesSection({ projectId, updates, canEdit }: CRAUpdatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      await addUpdate(projectId, content);
      setContent("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={submit} className="space-y-2">
          <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-3 text-sm"
            placeholder="Add a status update…" value={content}
            onChange={(e) => setContent(e.target.value)} disabled={isPending} />
          <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
            {isPending ? "Posting…" : "Post update"}
          </Button>
        </form>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No updates yet.</p>
      ) : (
        <ul className="space-y-3">
          {updates.map((u) => (
            <li key={u.id} className="rounded-md border border-border p-3 text-sm">
              <p className="whitespace-pre-wrap">{u.content}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {u.positions?.name ?? "unknown"} · {new Date(u.created_at).toLocaleDateString("en-US")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement the documents section**

Replace `components/hoa/CRADocumentsSection.tsx`. Mirror `DocumentUpload`'s storage flow: upload to the `documents` bucket from the browser, then call `addCRADocument(projectId, name, storagePath, "storage_file")`; also support a "paste URL" path calling `addCRADocument(projectId, name, url, "google_doc")`. List documents; storage files render through a signed-URL download (mirror how `/documents` builds signed URLs — call a small server action or generate on click). Editors get delete via `InlineConfirm` → `deleteCRADocument(id)`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addCRADocument, deleteCRADocument } from "@/actions/cra";
import { FileUploadButton } from "@/components/hoa/FileUploadButton";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Button } from "@/components/ui/button";
import type { CRADocument } from "@/types/database";

interface CRADocumentsSectionProps {
  projectId: string;
  documents: CRADocument[];
  positionId: string;
  canEdit: boolean;
}

const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Document attachments for a CRA project. Supports uploading a file to the
 * 'documents' bucket or pasting an external URL. Editors can delete links.
 *
 * @param projectId  - Owning project UUID
 * @param documents  - Linked document rows
 * @param positionId - Current user's position UUID (for storage pathing)
 * @param canEdit    - Whether the current user may add/delete documents
 */
export function CRADocumentsSection({ projectId, documents, positionId, canEdit }: CRADocumentsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!file && !url.trim()) { setError("Choose a file or paste a URL."); return; }

    startTransition(async () => {
      try {
        if (file) {
          const supabase = createClient();
          const path = `cra/${projectId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("documents").upload(path, file, { contentType: file.type });
          if (upErr) throw new Error(upErr.message);
          await addCRADocument(projectId, name.trim(), path, "storage_file");
        } else {
          await addCRADocument(projectId, name.trim(), url.trim(), "google_doc");
        }
        setName(""); setUrl(""); setFile(null); setResetKey((k) => k + 1);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  };

  const open = (doc: CRADocument) =>
    startTransition(async () => {
      if (doc.url_type === "google_doc") { window.open(doc.url, "_blank"); return; }
      const supabase = createClient();
      const { data } = await supabase.storage.from("documents").createSignedUrl(doc.url, 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteCRADocument(id);
      setDeleteId(null);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <button type="button" className="text-primary underline" onClick={() => open(d)} disabled={isPending}>
                {d.name}
              </button>
              {canEdit && (deleteId === d.id ? (
                <InlineConfirm message="Remove?" confirmLabel="Remove"
                  onConfirm={() => remove(d.id)} onDismiss={() => setDeleteId(null)} isPending={isPending} />
              ) : (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setDeleteId(d.id)}>Remove</Button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-border p-3">
          <input className={input} placeholder="Document name" value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
          <FileUploadButton accept=".pdf,.docx,.doc,.jpg,.jpeg,.png" label="Choose file"
            onChange={(files) => setFile(files[0] ?? null)} disabled={isPending} resetKey={resetKey} />
          <input className={input} placeholder="…or paste a URL" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isPending} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Add document"}</Button>
        </form>
      )}
    </div>
  );
}
```

> `positionId` is passed for parity with `DocumentUpload`; CRA documents don't store an uploader, so it's currently unused — either drop it from the props or keep for a future "uploaded by" column. Remove the prop from the page call site if you drop it.

- [ ] **Step 3: Export the three section components** (if you want them in the barrel; the detail page imports them directly, so this is optional). If exporting, add to `components/hoa/index.ts`.

- [ ] **Step 4: Type-check + commit**

Run: `pnpm type-check`
Expected: PASS

```bash
git add components/hoa/CRAUpdatesSection.tsx components/hoa/CRADocumentsSection.tsx
git commit -m "feat(cra): immutable updates log + document attachments"
```

---

### Task 13: Sidebar CRA-chair link (TDD)

**Files:**
- Modify: `components/hoa/Sidebar.tsx` (chair branch, lines ~56-73)
- Modify/Create: `components/hoa/Sidebar.test.tsx`

**Interfaces:**
- Produces: the `cra` chair sees a "CRA Projects" link; other chairs do not.

- [ ] **Step 1: Write the failing test**

In `components/hoa/Sidebar.test.tsx` (create if absent), add:

```tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Position } from "@/types/database";

function position(p: Partial<Position>): Position {
  return { id: "1", name: "cra", email: "x@y.z", role: "chair", display_name: null, ...p } as Position;
}

describe("Sidebar chair nav", () => {
  it("shows CRA Projects for the cra chair", () => {
    render(<Sidebar position={position({ name: "cra", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "CRA Projects" })).toBeInTheDocument();
  });

  it("hides CRA Projects from other chairs", () => {
    render(<Sidebar position={position({ name: "architecture", role: "chair" })} />);
    expect(screen.queryByRole("link", { name: "CRA Projects" })).not.toBeInTheDocument();
  });
});
```

> Confirm the `Position` shape (run `grep -n "display_name\|email" types/database.ts | head`) and adjust the `position()` factory so it matches the real columns. If `usePathname` needs mocking, follow the existing test setup used elsewhere (check `jest.config`/`jest.setup` for a `next/navigation` mock; add `jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))` if needed).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/hoa/Sidebar.test.tsx`
Expected: FAIL (cra chair has no CRA link yet).

- [ ] **Step 3: Add the conditional link**

In `components/hoa/Sidebar.tsx`, inside the chair-branch `<ul>` (after the Directory link, ~line 67), add:

```tsx
{position.name === "cra" && (
  <SidebarLink item={{ label: "CRA Projects", href: "/cra" }} active={isActive("/cra")} />
)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/hoa/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/hoa/Sidebar.tsx components/hoa/Sidebar.test.tsx
git commit -m "feat(cra): CRA chair sidebar link to /cra"
```

---

### Task 14: Dashboard uses shared `OPEN_STATUSES`

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx` (the cra_projects query, ~line 39-41)

**Interfaces:**
- Consumes: `OPEN_STATUSES` from `@/lib/cra/projects`.

- [ ] **Step 1: Replace the hardcoded status array**

In `app/(dashboard)/dashboard/page.tsx`, import the constant:

```ts
import { OPEN_STATUSES } from "@/lib/cra/projects";
```

and change the active-projects query filter from the inline `["proposed","approved","in_progress"]` to:

```ts
.in("status", OPEN_STATUSES)
```

so the dashboard "Active CRA Projects" card and the `/cra` Open tab share one definition (now including `on_hold`).

- [ ] **Step 2: Type-check + run suite**

Run: `pnpm type-check && pnpm test --ci`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(cra): dashboard active card uses shared OPEN_STATUSES"
```

---

### Task 15: Apply migration + manual verification

**Files:** none (operational)

- [ ] **Step 1: Confirm tables are empty** in the e2e Supabase SQL editor:

```sql
select
  (select count(*) from cra_projects)  as projects,
  (select count(*) from cra_quotes)    as quotes,
  (select count(*) from cra_updates)   as updates,
  (select count(*) from cra_documents) as documents;
```
Expected: all zero. (If not, do NOT run the `not null` ALTER as written — make `created_by` nullable + backfill.)

- [ ] **Step 2: Run `supabase/migrations/0022_cra_projects.sql`** in the e2e SQL editor.

- [ ] **Step 3: Verify RLS as the CRA chair.** Sign in to the preview deploy as the `cra` chair account; confirm you can create a project, add/select/delete a quote, post an update, upload + delete a document, and delete a project.

- [ ] **Step 4: Verify read-only enforcement.** Sign in as a `member` (e.g. pool); confirm `/cra` is read-only (no New Project button, no edit controls) and that a direct write would be denied (RLS).

- [ ] **Step 5: Verify author embed.** Confirm the updates log shows the author's position name (the `positions:created_by(name)` embed resolves). If it doesn't, switch the detail page query to fetch positions separately and map by id.

- [ ] **Step 6: Run the full suite once more**

Run: `pnpm type-check && pnpm test --ci && pnpm build`
Expected: all PASS.

- [ ] **Step 7: Open the PR** (CI must pass; 1 review required per CODEOWNERS). After merge to `main`, run migration 0022 against the **prod** Supabase project (same empty-table check first).

---

## Self-Review

- **Spec coverage:** scope/cents (Tasks 1,4), FY FK (1,8,9,10), category + datalist (9), priority + sort (5,9,10), target_date + overdue (7), status-only lifecycle (kept), quote contacts + is_selected + select (1,11), 3-quote soft readiness (5,7,11), RLS + is_cra_editor (1), canEditCRA chair (3), route guards (8,9,10), updates authorship fix (1,2,12), documents upload/URL (12), card list + tabs + totals (7,8), inline-edit detail (10), delete-with-confirm (10,11,12), sidebar chair link (13), dashboard shared constant (14), manual RLS verification (15). All spec sections map to a task.
- **Type consistency:** `OPEN_STATUSES`, `compareProjects`, `quoteReadiness`, `sumEstimated/sumActual` (Task 5) are referenced with matching names in Tasks 7/8/14; `parseDollarsToCents`/`formatCents` (Task 4) used consistently; action names in Task 6 match call sites in Tasks 9-12; `canEditCRA(role, positionName)` signature consistent across Tasks 3/8/9/10.
- **Known soft spots flagged inline:** `FormField` prop API (Task 9), settings `hoa_name` key (Task 9), `positions:created_by(name)` embed (Tasks 10/15), `Position` test shape + `next/navigation` mock (Task 13), quote in-place edit deferred to fast follow (Task 11). Each has a verification step or fallback.
```
