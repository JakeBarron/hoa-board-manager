# Treasury Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a financial dashboard for the HOA treasurer — CSV budget import, manual actuals entry, cash balance tracking, assessment payment status per homeowner, and a visual overview for all board members.

**Architecture:** Supabase-backed data model with 6 new tables; a pure CSV parser for the Homeside GL export format; three new treasury routes plus assessment columns added to the existing Properties page. Server Components fetch and pass data; Client Components handle charts, expandable rows, and forms.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Recharts (install required), csv-parse (already installed), react-hook-form + zod, Tailwind + shadcn/ui v4.

---

## File Map

**New files:**
- `supabase/migrations/0018_treasury_schema.sql`
- `lib/treasury/csv-parser.ts`
- `lib/treasury/csv-parser.test.ts`
- `actions/treasury.ts`
- `app/(dashboard)/treasury/page.tsx`
- `app/(dashboard)/treasury/actuals/page.tsx`
- `app/(dashboard)/treasury/budget/page.tsx`
- `components/hoa/ActualsForm.tsx`
- `components/hoa/CSVImportDialog.tsx`
- `components/hoa/CategoryBreakdown.tsx`
- `components/hoa/TreasuryCharts.tsx`
- `components/hoa/AssessmentEditPanel.tsx`

**Modified files:**
- `types/database.ts` — add 6 table types + new union types
- `types/domain.ts` — add treasury domain types
- `lib/permissions.ts` — add `canEditTreasury`
- `lib/permissions.test.ts` — add `canEditTreasury` tests
- `components/hoa/Sidebar.tsx` — add Treasury nav link
- `components/hoa/index.ts` — export new components
- `app/(dashboard)/properties/page.tsx` — fetch assessment_payments
- `components/hoa/PropertiesView.tsx` — add assessment columns + inline edit

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0018_treasury_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0018_treasury_schema.sql

create table fiscal_years (
  id                         uuid primary key default gen_random_uuid(),
  label                      text not null,
  start_date                 date not null,
  end_date                   date not null,
  default_assessment_amount  integer not null,
  status                     text not null default 'draft'
                               check (status in ('draft', 'approved')),
  created_at                 timestamptz not null default now()
);

create table budget_line_items (
  id              uuid primary key default gen_random_uuid(),
  fiscal_year_id  uuid not null references fiscal_years(id) on delete cascade,
  gl_code         text not null,
  description     text not null,
  category        text not null,
  account_type    text not null
                    check (account_type in (
                      'operating_income','operating_expense',
                      'reserve_income','reserve_expense'
                    )),
  budget_amount   integer not null,
  unique (fiscal_year_id, gl_code)
);

create table budget_monthly_amounts (
  id                   uuid primary key default gen_random_uuid(),
  budget_line_item_id  uuid not null references budget_line_items(id) on delete cascade,
  month_start          date not null,
  amount               integer not null,
  unique (budget_line_item_id, month_start)
);

create table budget_category_actuals (
  id                    uuid primary key default gen_random_uuid(),
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  category              text not null,
  account_type          text not null
                          check (account_type in (
                            'operating_income','operating_expense',
                            'reserve_income','reserve_expense'
                          )),
  as_of_date            date not null,
  ytd_actual            integer not null,
  entered_by_position_id uuid not null references positions(id),
  entered_at            timestamptz not null default now(),
  unique (fiscal_year_id, category, account_type, as_of_date)
);

create table cash_balances (
  id                    uuid primary key default gen_random_uuid(),
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  as_of_date            date not null,
  operating_balance     integer not null,
  reserve_balance       integer not null,
  entered_by_position_id uuid not null references positions(id),
  entered_at            timestamptz not null default now()
);

create table assessment_payments (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references properties(id) on delete cascade,
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  status                text not null default 'unpaid'
                          check (status in ('paid','partial','unpaid','waived')),
  amount_due            integer not null,
  amount_paid           integer not null default 0,
  payment_reference     text,
  paid_at               date,
  notes                 text,
  entered_by_position_id uuid references positions(id),
  entered_at            timestamptz not null default now(),
  unique (property_id, fiscal_year_id)
);

-- Enable RLS
alter table fiscal_years enable row level security;
alter table budget_line_items enable row level security;
alter table budget_monthly_amounts enable row level security;
alter table budget_category_actuals enable row level security;
alter table cash_balances enable row level security;
alter table assessment_payments enable row level security;

-- Helper: returns true if the current user can edit treasury data
-- (president, officer, or Treasurer position)
create or replace function is_treasury_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
    and (role in ('president','officer') or name = 'treasurer')
  );
$$;

-- fiscal_years: all authenticated can read; treasury editors can write
create policy "fy_read" on fiscal_years for select to authenticated using (true);
create policy "fy_write" on fiscal_years for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_line_items
create policy "bli_read" on budget_line_items for select to authenticated using (true);
create policy "bli_write" on budget_line_items for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_monthly_amounts
create policy "bma_read" on budget_monthly_amounts for select to authenticated using (true);
create policy "bma_write" on budget_monthly_amounts for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_category_actuals
create policy "bca_read" on budget_category_actuals for select to authenticated using (true);
create policy "bca_write" on budget_category_actuals for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- cash_balances
create policy "cb_read" on cash_balances for select to authenticated using (true);
create policy "cb_write" on cash_balances for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- assessment_payments: voting members can read; treasury editors can write
create policy "ap_read" on assessment_payments for select to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president','officer','member')
    )
  );
create policy "ap_write" on assessment_payments for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- Grants (required for tables created after initial "grant all" snapshot)
grant all on fiscal_years to anon, authenticated, service_role;
grant all on budget_line_items to anon, authenticated, service_role;
grant all on budget_monthly_amounts to anon, authenticated, service_role;
grant all on budget_category_actuals to anon, authenticated, service_role;
grant all on cash_balances to anon, authenticated, service_role;
grant all on assessment_payments to anon, authenticated, service_role;
```

- [ ] **Step 2: Run the migration**

Paste the SQL into Supabase Dashboard → SQL Editor and execute.
Verify no errors in the output.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0018_treasury_schema.sql
git commit -m "feat: add treasury schema (fiscal years, budget, actuals, assessments)"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/database.ts`
- Modify: `types/domain.ts`

- [ ] **Step 1: Add new union types to `types/database.ts`**

After the existing union types block (after `export type DocumentType = ...`), add:

```ts
export type FiscalYearStatus = "draft" | "approved";

export type AccountType =
  | "operating_income"
  | "operating_expense"
  | "reserve_income"
  | "reserve_expense";

export type AssessmentStatus = "paid" | "partial" | "unpaid" | "waived";
```

- [ ] **Step 2: Add table definitions to the `Tables` object in `types/database.ts`**

Inside `Database["public"]["Tables"]`, before the closing `};`, add:

```ts
      fiscal_years: {
        Row: {
          id: string;
          label: string;
          start_date: string;
          end_date: string;
          default_assessment_amount: number;
          status: FiscalYearStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          start_date: string;
          end_date: string;
          default_assessment_amount: number;
          status?: FiscalYearStatus;
          created_at?: string;
        };
        Update: {
          label?: string;
          start_date?: string;
          end_date?: string;
          default_assessment_amount?: number;
          status?: FiscalYearStatus;
        };
        Relationships: [];
      };
      budget_line_items: {
        Row: {
          id: string;
          fiscal_year_id: string;
          gl_code: string;
          description: string;
          category: string;
          account_type: AccountType;
          budget_amount: number;
        };
        Insert: {
          id?: string;
          fiscal_year_id: string;
          gl_code: string;
          description: string;
          category: string;
          account_type: AccountType;
          budget_amount: number;
        };
        Update: {
          description?: string;
          budget_amount?: number;
        };
        Relationships: [];
      };
      budget_monthly_amounts: {
        Row: {
          id: string;
          budget_line_item_id: string;
          month_start: string;
          amount: number;
        };
        Insert: {
          id?: string;
          budget_line_item_id: string;
          month_start: string;
          amount: number;
        };
        Update: {
          amount?: number;
        };
        Relationships: [];
      };
      budget_category_actuals: {
        Row: {
          id: string;
          fiscal_year_id: string;
          category: string;
          account_type: AccountType;
          as_of_date: string;
          ytd_actual: number;
          entered_by_position_id: string;
          entered_at: string;
        };
        Insert: {
          id?: string;
          fiscal_year_id: string;
          category: string;
          account_type: AccountType;
          as_of_date: string;
          ytd_actual: number;
          entered_by_position_id: string;
          entered_at?: string;
        };
        Update: {
          ytd_actual?: number;
          as_of_date?: string;
          entered_at?: string;
        };
        Relationships: [];
      };
      cash_balances: {
        Row: {
          id: string;
          fiscal_year_id: string;
          as_of_date: string;
          operating_balance: number;
          reserve_balance: number;
          entered_by_position_id: string;
          entered_at: string;
        };
        Insert: {
          id?: string;
          fiscal_year_id: string;
          as_of_date: string;
          operating_balance: number;
          reserve_balance: number;
          entered_by_position_id: string;
          entered_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      assessment_payments: {
        Row: {
          id: string;
          property_id: string;
          fiscal_year_id: string;
          status: AssessmentStatus;
          amount_due: number;
          amount_paid: number;
          payment_reference: string | null;
          paid_at: string | null;
          notes: string | null;
          entered_by_position_id: string | null;
          entered_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          fiscal_year_id: string;
          status?: AssessmentStatus;
          amount_due: number;
          amount_paid?: number;
          payment_reference?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          entered_by_position_id?: string | null;
          entered_at?: string;
        };
        Update: {
          status?: AssessmentStatus;
          amount_paid?: number;
          payment_reference?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          entered_by_position_id?: string | null;
          entered_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Add convenience row types at the bottom of `types/database.ts`**

After the existing row type exports, add:

```ts
export type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"];
export type BudgetLineItem = Database["public"]["Tables"]["budget_line_items"]["Row"];
export type BudgetMonthlyAmount = Database["public"]["Tables"]["budget_monthly_amounts"]["Row"];
export type CategoryActual = Database["public"]["Tables"]["budget_category_actuals"]["Row"];
export type CashBalance = Database["public"]["Tables"]["cash_balances"]["Row"];
export type AssessmentPayment = Database["public"]["Tables"]["assessment_payments"]["Row"];
```

- [ ] **Step 4: Add domain types to `types/domain.ts`**

Append to `types/domain.ts`:

```ts
import type {
  FiscalYear,
  BudgetLineItem,
  CategoryActual,
  AccountType,
} from "./database";

/**
 * Budget totals for one category+account_type pair, merged with the latest actuals.
 * Built server-side by grouping budget_line_items and joining with budget_category_actuals.
 */
export interface CategoryBudgetSummary {
  category: string;
  account_type: AccountType;
  budget_amount: number;
  ytd_actual: number;
  as_of_date: string | null;
  line_items: BudgetLineItem[];
}

/** Aggregate assessment counts used on the treasury overview strip. */
export interface AssessmentSummary {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  waived: number;
  total_due: number;
  total_paid: number;
}
```

- [ ] **Step 5: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add types/database.ts types/domain.ts
git commit -m "feat: add treasury table types and domain types"
```

---

## Task 3: canEditTreasury Permission

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/permissions.test.ts`

- [ ] **Step 1: Write failing tests in `lib/permissions.test.ts`**

Add at the bottom of the file, after the existing `describe` blocks:

```ts
describe("canEditTreasury", () => {
  it("returns true for president", () => {
    expect(canEditTreasury("president", "president")).toBe(true);
  });

  it("returns true for officer role (VP, secretary)", () => {
    expect(canEditTreasury("officer", "vp")).toBe(true);
    expect(canEditTreasury("officer", "secretary")).toBe(true);
  });

  it("returns true for the treasurer position regardless of role", () => {
    expect(canEditTreasury("member", "treasurer")).toBe(true);
  });

  it("returns false for non-treasurer members", () => {
    expect(canEditTreasury("member", "pool")).toBe(false);
    expect(canEditTreasury("member", "social")).toBe(false);
  });

  it("returns false for committee chairs", () => {
    expect(canEditTreasury("chair", "architecture")).toBe(false);
  });
});
```

- [ ] **Step 2: Add the import at the top of the test file**

Update the import line at the top of `lib/permissions.test.ts`:

```ts
import {
  canEditAll,
  canEditSection,
  isAdmin,
  canEditCRA,
  canRecordVote,
  isChair,
  canEditTreasury,
} from "./permissions";
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test lib/permissions.test.ts
```

Expected: FAIL — `canEditTreasury is not a function`

- [ ] **Step 4: Implement `canEditTreasury` in `lib/permissions.ts`**

Add after the `isChair` function:

```ts
/**
 * Returns true if the user can create or modify treasury data.
 * President and officers (VP, secretary) have edit access by explicit policy decision.
 * The Treasurer position always has edit access regardless of role label.
 *
 * @param role         - The current user's position role
 * @param positionName - The current user's position name
 */
export const canEditTreasury = (
  role: PositionRole,
  positionName: PositionName
): boolean =>
  role === "president" || role === "officer" || positionName === "treasurer";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test lib/permissions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat: add canEditTreasury permission function"
```

---

## Task 4: CSV Parser

**Files:**
- Create: `lib/treasury/csv-parser.ts`
- Create: `lib/treasury/csv-parser.test.ts`

- [ ] **Step 1: Write failing tests in `lib/treasury/csv-parser.test.ts`**

```ts
import { parseBudgetCSV } from "./csv-parser";
import type { ParsedBudgetRow } from "./csv-parser";

const FISCAL_YEAR_START = "2025-04-01";

// Minimal valid CSV with one operating income row and one reserve expense row
const SAMPLE_CSV = `East Spring Lake FY26 Budget

GL Code,Account Description,2026 Budget,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Jan,Feb,Mar
Operating Accounts
Income Accounts
G&A
40-4000-00,Member Assessment,"$146,200","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,192"
Expense Accounts
G&A
50-5000-00,Management Fee,"$46,800","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900"
Reserve Accounts
Expense Accounts
Replacement Fund
80-8000-00,Pool Replacement,"$10,000","$833","$833","$833","$833","$833","$833","$833","$833","$833","$833","$833","$837"
`;

describe("parseBudgetCSV", () => {
  it("parses operating income rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00");
    expect(row).toBeDefined();
    expect(row!.description).toBe("Member Assessment");
    expect(row!.category).toBe("G&A");
    expect(row!.account_type).toBe("operating_income");
    expect(row!.budget_amount).toBe(14620000); // $146,200 in cents
  });

  it("parses operating expense rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "50-5000-00");
    expect(row!.account_type).toBe("operating_expense");
    expect(row!.budget_amount).toBe(4680000); // $46,800 in cents
  });

  it("parses reserve expense rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "80-8000-00");
    expect(row!.account_type).toBe("reserve_expense");
    expect(row!.category).toBe("Replacement Fund");
  });

  it("generates correct month_start dates for fiscal year", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00")!;
    expect(row.monthly_amounts).toHaveLength(12);
    expect(row.monthly_amounts[0].month_start).toBe("2025-04-01");
    expect(row.monthly_amounts[11].month_start).toBe("2026-03-01");
  });

  it("converts monthly amounts to cents", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00")!;
    expect(row.monthly_amounts[0].amount).toBe(1218300); // $12,183 in cents
  });

  it("returns no errors for valid CSV", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it("returns an error if no header row is found", () => {
    const result = parseBudgetCSV("GL Code,Description\n40-4000-00,Member Assessment", FISCAL_YEAR_START);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/header/i);
  });

  it("skips rows without a valid GL code", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const nonGl = result.rows.filter((r) => !/^\d{2}-\d{4}-\d{2}$/.test(r.gl_code));
    expect(nonGl).toHaveLength(0);
  });

  it("handles missing monthly amount cells as 0", () => {
    const csv = `
GL Code,Account Description,2026 Budget,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Jan,Feb,Mar
Operating Accounts
Income Accounts
Misc
40-9999-00,Misc Income,$1200,$100
`;
    const result = parseBudgetCSV(csv, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-9999-00")!;
    expect(row.monthly_amounts[1].amount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/treasury/csv-parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the CSV parser at `lib/treasury/csv-parser.ts`**

```ts
import { parse } from "csv-parse/sync";
import type { AccountType } from "@/types/database";

export interface ParsedBudgetRow {
  gl_code: string;
  description: string;
  category: string;
  account_type: AccountType;
  budget_amount: number;
  monthly_amounts: { month_start: string; amount: number }[];
}

export interface CSVParseResult {
  rows: ParsedBudgetRow[];
  errors: string[];
  skippedCount: number;
}

const GL_CODE_RE = /^\d{2}-\d{4}-\d{2}$/;
const FISCAL_MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

/**
 * Parses a Homeside GL CSV export into structured budget line items.
 * Converts dollar amounts to integer cents. Section headers update
 * context (Operating/Reserve, Income/Expense, Category). GL rows
 * become ParsedBudgetRow entries. Errors are non-fatal; check the
 * errors array before persisting.
 *
 * @param csvText         - Raw CSV string from file upload
 * @param fiscalYearStart - ISO date of the fiscal year's April 1 (e.g. "2025-04-01")
 */
export function parseBudgetCSV(csvText: string, fiscalYearStart: string): CSVParseResult {
  const rows: ParsedBudgetRow[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  const records: string[][] = parse(csvText.trim(), {
    relax_column_count: true,
    skip_empty_lines: true,
  });

  const headerIdx = findHeaderRowIndex(records);
  if (headerIdx === -1) {
    return { rows: [], errors: ["Could not find header row containing month column names (Apr–Mar)."], skippedCount: records.length };
  }

  const header = records[headerIdx].map((h) => h.toLowerCase().trim());
  const glCol = findColumnIndex(header, ["gl code", "gl #", "account number", "account #"]) ?? 0;
  const descCol = findColumnIndex(header, ["account description", "description", "name"]) ?? 1;
  const budgetCol = findColumnIndex(header, []) ?? findBudgetColumn(header);
  const monthCols = FISCAL_MONTHS.map((m) => header.findIndex((h) => h.startsWith(m)));
  const monthStarts = generateMonthStarts(fiscalYearStart);

  type AccountSection = "operating" | "reserve";
  type IncomeSection = "income" | "expense";

  let accountSection: AccountSection | null = null;
  let incomeSection: IncomeSection | null = null;
  let category: string | null = null;

  for (let i = headerIdx + 1; i < records.length; i++) {
    const record = records[i];
    const glCell = (record[glCol] ?? "").trim();
    const descCell = (record[descCol] ?? "").trim();
    const text = (descCell || glCell || record[0] || "").toLowerCase().trim();

    if (!glCell && !descCell && !record[0]?.trim()) continue;

    if (GL_CODE_RE.test(glCell)) {
      if (!accountSection || !incomeSection || !category) {
        errors.push(`Row ${i + 1}: GL code "${glCell}" found before section context was established — skipped.`);
        continue;
      }

      const account_type: AccountType = `${accountSection}_${incomeSection}` as AccountType;
      const budgetStr = (record[budgetCol] ?? "").replace(/[$,\s]/g, "");
      const budget_amount = parseCents(budgetStr);

      const monthly_amounts = FISCAL_MONTHS.map((_, idx) => {
        const colIdx = monthCols[idx];
        const raw = colIdx >= 0 && colIdx < record.length ? record[colIdx] : "";
        return {
          month_start: monthStarts[idx],
          amount: parseCents(raw.replace(/[$,\s]/g, "")),
        };
      });

      rows.push({ gl_code: glCell, description: descCell, category, account_type, budget_amount, monthly_amounts });
    } else {
      // Section context header
      if (text.includes("operating account")) {
        accountSection = "operating";
        incomeSection = null;
        category = null;
      } else if (text.includes("reserve account")) {
        accountSection = "reserve";
        incomeSection = null;
        category = null;
      } else if (text === "income accounts" || text === "income") {
        incomeSection = "income";
        category = null;
      } else if (text === "expense accounts" || text === "expense") {
        incomeSection = "expense";
        category = null;
      } else if (text && accountSection && incomeSection) {
        category = descCell || glCell || (record[0] ?? "").trim();
      } else {
        skippedCount++;
      }
    }
  }

  return { rows, errors, skippedCount };
}

function findHeaderRowIndex(records: string[][]): number {
  const monthSet = new Set(FISCAL_MONTHS);
  for (let i = 0; i < records.length; i++) {
    const row = records[i].map((c) => c.toLowerCase().trim());
    const hits = row.filter((c) => monthSet.has(c)).length;
    if (hits >= 3) return i;
  }
  return -1;
}

function findColumnIndex(header: string[], candidates: string[]): number | null {
  for (const candidate of candidates) {
    const idx = header.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return null;
}

function findBudgetColumn(header: string[]): number {
  const idx = header.findIndex((h) => /\d{4}/.test(h) && h.includes("budget"));
  return idx >= 0 ? idx : 2;
}

function parseCents(value: string): number {
  if (!value || value === "-" || value === "") return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/**
 * Generates 12 month_start ISO date strings beginning at fiscalYearStart (April 1).
 * Months wrap into the next calendar year after December.
 */
function generateMonthStarts(fiscalYearStart: string): string[] {
  const starts: string[] = [];
  const base = new Date(fiscalYearStart + "T00:00:00Z");
  for (let i = 0; i < 12; i++) {
    const d = new Date(base);
    d.setUTCMonth(base.getUTCMonth() + i);
    starts.push(d.toISOString().slice(0, 10));
  }
  return starts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/treasury/csv-parser.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/treasury/csv-parser.ts lib/treasury/csv-parser.test.ts
git commit -m "feat: add Homeside GL CSV parser with tests"
```

---

## Task 5: Treasury Server Actions

**Files:**
- Create: `actions/treasury.ts`

- [ ] **Step 1: Create `actions/treasury.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import type { AccountType, AssessmentStatus } from "@/types/database";
import type { ParsedBudgetRow } from "@/lib/treasury/csv-parser";

/** Resolves the current user's position. Throws if unauthenticated or no position found. */
async function requirePosition() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: position } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();

  if (!position) throw new Error("Position not found");
  return { supabase, position };
}

/** Resolves position and verifies canEditTreasury. Throws if unauthorized. */
async function requireTreasuryEditor() {
  const { supabase, position } = await requirePosition();
  if (!canEditTreasury(position.role, position.name)) {
    throw new Error("Not authorized to edit treasury data");
  }
  return { supabase, position };
}

/**
 * Creates a new fiscal year in draft status.
 * Returns the new fiscal year's id.
 *
 * @param label                    - e.g. "FY26"
 * @param startDate                - ISO date "2025-04-01"
 * @param endDate                  - ISO date "2026-03-31"
 * @param defaultAssessmentAmount  - Annual assessment in cents
 */
export async function createFiscalYear(
  label: string,
  startDate: string,
  endDate: string,
  defaultAssessmentAmount: number
): Promise<string> {
  const { supabase } = await requireTreasuryEditor();

  const { data, error } = await supabase
    .from("fiscal_years")
    .insert({ label, start_date: startDate, end_date: endDate, default_assessment_amount: defaultAssessmentAmount })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/treasury", "layout");
  return data.id;
}

/**
 * Replaces all budget line items and monthly amounts for a fiscal year.
 * The fiscal year must be in 'draft' status. Existing line items are deleted
 * first (cascade removes monthly amounts), then new ones are inserted.
 *
 * @param fiscalYearId - UUID of the fiscal year to import into
 * @param rows         - Parsed rows from parseBudgetCSV()
 */
export async function importBudget(
  fiscalYearId: string,
  rows: ParsedBudgetRow[]
): Promise<void> {
  const { supabase } = await requireTreasuryEditor();

  // Verify draft status
  const { data: fy } = await supabase
    .from("fiscal_years")
    .select("status")
    .eq("id", fiscalYearId)
    .single();
  if (fy?.status !== "draft") throw new Error("Cannot import: budget is already approved.");

  // Delete existing line items (monthly amounts cascade)
  const { error: delError } = await supabase
    .from("budget_line_items")
    .delete()
    .eq("fiscal_year_id", fiscalYearId);
  if (delError) throw new Error(delError.message);

  if (rows.length === 0) {
    revalidatePath("/treasury", "layout");
    return;
  }

  // Insert line items
  const lineItemInserts = rows.map((r) => ({
    fiscal_year_id: fiscalYearId,
    gl_code: r.gl_code,
    description: r.description,
    category: r.category,
    account_type: r.account_type,
    budget_amount: r.budget_amount,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("budget_line_items")
    .insert(lineItemInserts)
    .select("id, gl_code");
  if (insertError) throw new Error(insertError.message);

  // Insert monthly amounts
  const monthlyInserts = inserted.flatMap((item) => {
    const row = rows.find((r) => r.gl_code === item.gl_code)!;
    return row.monthly_amounts.map((m) => ({
      budget_line_item_id: item.id,
      month_start: m.month_start,
      amount: m.amount,
    }));
  });

  const { error: monthlyError } = await supabase
    .from("budget_monthly_amounts")
    .insert(monthlyInserts);
  if (monthlyError) throw new Error(monthlyError.message);

  revalidatePath("/treasury", "layout");
}

/**
 * Sets fiscal year status to 'approved', locking the budget from re-import.
 * President only.
 *
 * @param fiscalYearId - UUID of the fiscal year to approve
 */
export async function approveBudget(fiscalYearId: string): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();
  if (position.role !== "president") throw new Error("Only the president can approve budgets.");

  const { error } = await supabase
    .from("fiscal_years")
    .update({ status: "approved" })
    .eq("id", fiscalYearId);
  if (error) throw new Error(error.message);
  revalidatePath("/treasury", "layout");
}

/**
 * Upserts YTD category actuals and a cash balance snapshot for a given date.
 * Uses upsert on (fiscal_year_id, category, account_type, as_of_date) so
 * re-submitting the same date overwrites the previous entry.
 *
 * @param fiscalYearId     - UUID of the active fiscal year
 * @param asOfDate         - ISO date the actuals are through (e.g. "2025-11-30")
 * @param categoryActuals  - Array of { category, account_type, ytd_actual (cents) }
 * @param operatingBalance - Operating account cash in cents
 * @param reserveBalance   - Reserve account cash in cents
 */
export async function saveActuals(
  fiscalYearId: string,
  asOfDate: string,
  categoryActuals: { category: string; account_type: AccountType; ytd_actual: number }[],
  operatingBalance: number,
  reserveBalance: number
): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();

  const upserts = categoryActuals.map((ca) => ({
    fiscal_year_id: fiscalYearId,
    category: ca.category,
    account_type: ca.account_type,
    as_of_date: asOfDate,
    ytd_actual: ca.ytd_actual,
    entered_by_position_id: position.id,
    entered_at: new Date().toISOString(),
  }));

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("budget_category_actuals")
      .upsert(upserts, { onConflict: "fiscal_year_id,category,account_type,as_of_date" });
    if (error) throw new Error(error.message);
  }

  const { error: cbError } = await supabase
    .from("cash_balances")
    .insert({
      fiscal_year_id: fiscalYearId,
      as_of_date: asOfDate,
      operating_balance: operatingBalance,
      reserve_balance: reserveBalance,
      entered_by_position_id: position.id,
    });
  if (cbError) throw new Error(cbError.message);

  revalidatePath("/treasury", "layout");
}

/**
 * Creates assessment_payments rows for all active properties using the
 * fiscal year's default_assessment_amount. Safe to re-run (upsert on conflict).
 *
 * @param fiscalYearId - UUID of the fiscal year to initialize assessments for
 */
export async function initializeAssessments(fiscalYearId: string): Promise<void> {
  const { supabase } = await requireTreasuryEditor();

  const [fyResult, propsResult] = await Promise.all([
    supabase.from("fiscal_years").select("default_assessment_amount").eq("id", fiscalYearId).single(),
    supabase.from("properties").select("id"),
  ]);

  if (fyResult.error) throw new Error(fyResult.error.message);
  if (propsResult.error) throw new Error(propsResult.error.message);

  const amountDue = fyResult.data.default_assessment_amount;
  const inserts = (propsResult.data ?? []).map((p) => ({
    property_id: p.id,
    fiscal_year_id: fiscalYearId,
    amount_due: amountDue,
  }));

  const { error } = await supabase
    .from("assessment_payments")
    .upsert(inserts, { onConflict: "property_id,fiscal_year_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/treasury");
}

/**
 * Updates a single assessment payment record.
 *
 * @param id               - UUID of the assessment_payment row
 * @param status           - New payment status
 * @param amountPaid       - Amount paid in cents
 * @param paymentReference - Check number, online payment ID, etc.
 * @param paidAt           - ISO date of payment
 * @param notes            - Free-text notes
 */
export async function updateAssessmentPayment(
  id: string,
  status: AssessmentStatus,
  amountPaid: number,
  paymentReference: string | null,
  paidAt: string | null,
  notes: string | null
): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();

  const { error } = await supabase
    .from("assessment_payments")
    .update({
      status,
      amount_paid: amountPaid,
      payment_reference: paymentReference,
      paid_at: paidAt,
      notes,
      entered_by_position_id: position.id,
      entered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/properties");
  revalidatePath("/treasury");
}
```

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add actions/treasury.ts
git commit -m "feat: add treasury server actions"
```

---

## Task 6: Sidebar Nav Link

**Files:**
- Modify: `components/hoa/Sidebar.tsx`

- [ ] **Step 1: Add Treasury to FUNCTION_NAV**

In `components/hoa/Sidebar.tsx`, find the `FUNCTION_NAV` array and add the Treasury entry before Properties:

```ts
const FUNCTION_NAV: NavItem[] = [
  { label: "Meetings", href: "/meetings" },
  { label: "Architecture", href: "/architecture" },
  { label: "Documents", href: "/documents" },
  { label: "CRA Projects", href: "/cra" },
  { label: "Agenda", href: "/agenda" },
  { label: "Treasury", href: "/treasury" },
  { label: "Amenities", href: "/amenities" },
  { label: "Properties", href: "/properties" },
  { label: "Map", href: "/map" },
];
```

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

- [ ] **Step 3: Commit**

```bash
git add components/hoa/Sidebar.tsx
git commit -m "feat: add Treasury to sidebar navigation"
```

---

## Task 7: Treasury Overview Page

**Files:**
- Create: `app/(dashboard)/treasury/page.tsx`

The page fetches all treasury data server-side and renders it statically with one interactive Client Component (`CategoryBreakdown`) for expandable rows.

- [ ] **Step 1: Create the page**

```ts
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CategoryBreakdown } from "@/components/hoa/CategoryBreakdown";
import type { CategoryBudgetSummary, AssessmentSummary } from "@/types/domain";
import type { CashBalance, FiscalYear, CategoryActual, BudgetLineItem } from "@/types/database";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Treasury — HOA Board" };

/** Formats an integer cent amount as a USD string, e.g. 14620000 → "$146,200" */
function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

/** Returns the most recent actuals per (category, account_type) combination. */
function latestActualsMap(actuals: CategoryActual[]): Map<string, CategoryActual> {
  const map = new Map<string, CategoryActual>();
  // actuals arrive ordered desc by as_of_date; first hit per key is the latest
  for (const a of actuals) {
    const key = `${a.category}:${a.account_type}`;
    if (!map.has(key)) map.set(key, a);
  }
  return map;
}

/** Groups budget line items into CategoryBudgetSummary records, joined with latest actuals. */
function buildCategoryBudgets(
  items: BudgetLineItem[],
  actualsMap: Map<string, CategoryActual>
): CategoryBudgetSummary[] {
  const groups = new Map<string, CategoryBudgetSummary>();
  for (const item of items) {
    const key = `${item.category}:${item.account_type}`;
    if (!groups.has(key)) {
      const actual = actualsMap.get(key);
      groups.set(key, {
        category: item.category,
        account_type: item.account_type,
        budget_amount: 0,
        ytd_actual: actual?.ytd_actual ?? 0,
        as_of_date: actual?.as_of_date ?? null,
        line_items: [],
      });
    }
    const g = groups.get(key)!;
    g.budget_amount += item.budget_amount;
    g.line_items.push(item);
  }
  return Array.from(groups.values());
}

export default async function TreasuryPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;
  const canEdit = canEditTreasury(position.role, position.name);

  // Fetch fiscal years (most recent first)
  const fyResult = await supabase
    .from("fiscal_years")
    .select("*")
    .order("start_date", { ascending: false });
  const fiscalYears = fyResult.data ?? [];
  const currentFY: FiscalYear | null = fiscalYears[0] ?? null;

  if (!currentFY) {
    return (
      <div className="space-y-6">
        <PageHeader title="Treasury" subtitle="Financial overview" />
        <SectionCard title="No fiscal year found">
          <p className="text-muted-foreground text-sm">
            {canEdit
              ? "Create a fiscal year to get started."
              : "No fiscal year has been set up yet."}
          </p>
          {canEdit && (
            <div className="mt-4">
              <Button render={<Link href="/treasury/budget" />} nativeButton={false}>
                Set Up Budget
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // Parallel data fetch for current fiscal year
  const [cbResult, actualsResult, itemsResult, apResult] = await Promise.all([
    supabase
      .from("cash_balances")
      .select("*")
      .eq("fiscal_year_id", currentFY.id)
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("budget_category_actuals")
      .select("*")
      .eq("fiscal_year_id", currentFY.id)
      .order("as_of_date", { ascending: false }),
    supabase
      .from("budget_line_items")
      .select("*")
      .eq("fiscal_year_id", currentFY.id),
    supabase
      .from("assessment_payments")
      .select("status, amount_due, amount_paid")
      .eq("fiscal_year_id", currentFY.id),
  ]);

  const cashBalance: CashBalance | null = cbResult.data ?? null;
  const actuals = actualsResult.data ?? [];
  const lineItems = itemsResult.data ?? [];
  const assessmentRows = apResult.data ?? [];

  const actualsMap = latestActualsMap(actuals);
  const categoryBudgets = buildCategoryBudgets(lineItems, actualsMap);

  // Income vs expense summary
  const totalBudgetIncome = categoryBudgets
    .filter((c) => c.account_type.endsWith("_income"))
    .reduce((s, c) => s + c.budget_amount, 0);
  const totalActualIncome = categoryBudgets
    .filter((c) => c.account_type.endsWith("_income"))
    .reduce((s, c) => s + c.ytd_actual, 0);
  const totalBudgetExpense = categoryBudgets
    .filter((c) => c.account_type.endsWith("_expense"))
    .reduce((s, c) => s + c.budget_amount, 0);
  const totalActualExpense = categoryBudgets
    .filter((c) => c.account_type.endsWith("_expense"))
    .reduce((s, c) => s + c.ytd_actual, 0);

  // Assessment summary
  const assessmentSummary: AssessmentSummary = {
    total: assessmentRows.length,
    paid: assessmentRows.filter((r) => r.status === "paid").length,
    partial: assessmentRows.filter((r) => r.status === "partial").length,
    unpaid: assessmentRows.filter((r) => r.status === "unpaid").length,
    waived: assessmentRows.filter((r) => r.status === "waived").length,
    total_due: assessmentRows.reduce((s, r) => s + r.amount_due, 0),
    total_paid: assessmentRows.reduce((s, r) => s + r.amount_paid, 0),
  };

  const incomeProgress = totalBudgetIncome > 0
    ? Math.round((totalActualIncome / totalBudgetIncome) * 100)
    : 0;
  const expenseProgress = totalBudgetExpense > 0
    ? Math.round((totalActualExpense / totalBudgetExpense) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Treasury — ${currentFY.label}`}
        subtitle={`${currentFY.status === "approved" ? "Budget approved" : "Budget draft"} · ${currentFY.start_date} to ${currentFY.end_date}`}
        action={
          canEdit ? (
            <Button render={<Link href="/treasury/actuals" />} nativeButton={false} variant="outline" size="sm">
              Enter Actuals
            </Button>
          ) : undefined
        }
      />

      {/* Cash on hand */}
      <SectionCard title="Cash on Hand">
        {cashBalance ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Operating</p>
              <p className="text-2xl font-semibold">{formatCents(cashBalance.operating_balance)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reserve</p>
              <p className="text-2xl font-semibold">{formatCents(cashBalance.reserve_balance)}</p>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              As of {cashBalance.as_of_date}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No balance entered yet.{" "}
            {canEdit && (
              <Link href="/treasury/actuals" className="underline">
                Enter one now
              </Link>
            )}
          </p>
        )}
      </SectionCard>

      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Income (YTD)">
          <p className="text-xl font-semibold">{formatCents(totalActualIncome)}</p>
          <p className="text-sm text-muted-foreground">of {formatCents(totalBudgetIncome)} budgeted</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(incomeProgress, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{incomeProgress}% collected</p>
        </SectionCard>

        <SectionCard title="Expenses (YTD)">
          <p className="text-xl font-semibold">{formatCents(totalActualExpense)}</p>
          <p className="text-sm text-muted-foreground">of {formatCents(totalBudgetExpense)} budgeted</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(expenseProgress, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{expenseProgress}% spent</p>
        </SectionCard>
      </div>

      {/* Assessments strip */}
      {assessmentSummary.total > 0 && (
        <SectionCard title="Assessments">
          <div className="flex flex-wrap gap-6 text-sm">
            <span><span className="font-semibold text-green-600">{assessmentSummary.paid}</span> paid</span>
            <span><span className="font-semibold text-yellow-600">{assessmentSummary.partial}</span> partial</span>
            <span><span className="font-semibold text-red-600">{assessmentSummary.unpaid}</span> unpaid</span>
            <span><span className="font-semibold">{assessmentSummary.waived}</span> waived</span>
            <span className="ml-auto">
              {formatCents(assessmentSummary.total_paid)} collected of {formatCents(assessmentSummary.total_due)}
            </span>
          </div>
          <div className="mt-2">
            <Link href="/properties?status=unpaid" className="text-sm underline text-muted-foreground">
              View unpaid →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Category breakdown */}
      {categoryBudgets.length > 0 && (
        <SectionCard title="Budget by Category">
          <CategoryBreakdown categories={categoryBudgets} />
        </SectionCard>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the `CategoryBreakdown` client component at `components/hoa/CategoryBreakdown.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { BudgetLineItem } from "@/types/database";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function accountTypeLabel(type: string): string {
  switch (type) {
    case "operating_income": return "Operating Income";
    case "operating_expense": return "Operating Expense";
    case "reserve_income": return "Reserve Income";
    case "reserve_expense": return "Reserve Expense";
    default: return type;
  }
}

interface CategoryBreakdownProps {
  categories: CategoryBudgetSummary[];
}

/**
 * Expandable table of budget categories with YTD actuals and GL line items.
 * Click a row to expand and see individual GL codes.
 */
export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Group by account_type for section headers
  const sections = ["operating_income", "operating_expense", "reserve_income", "reserve_expense"] as const;

  return (
    <div className="space-y-6">
      {sections.map((sectionType) => {
        const sectionCats = categories.filter((c) => c.account_type === sectionType);
        if (sectionCats.length === 0) return null;
        const sectionBudget = sectionCats.reduce((s, c) => s + c.budget_amount, 0);
        const sectionActual = sectionCats.reduce((s, c) => s + c.ytd_actual, 0);

        return (
          <div key={sectionType}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {accountTypeLabel(sectionType)}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">Category</th>
                  <th className="text-right py-1 font-medium">Budget</th>
                  <th className="text-right py-1 font-medium">YTD Actual</th>
                  <th className="text-right py-1 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {sectionCats.map((cat) => {
                  const key = `${cat.category}:${cat.account_type}`;
                  const remaining = cat.budget_amount - cat.ytd_actual;
                  const isOpen = expanded.has(key);
                  return (
                    <>
                      <tr
                        key={key}
                        onClick={() => toggle(key)}
                        className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2">
                          <span className="mr-1 text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                          {cat.category}
                        </td>
                        <td className="text-right py-2">{formatCents(cat.budget_amount)}</td>
                        <td className="text-right py-2">{cat.ytd_actual > 0 ? formatCents(cat.ytd_actual) : "—"}</td>
                        <td className={`text-right py-2 ${remaining < 0 ? "text-red-600" : ""}`}>
                          {formatCents(remaining)}
                        </td>
                      </tr>
                      {isOpen &&
                        cat.line_items.map((item: BudgetLineItem) => (
                          <tr key={item.id} className="border-b bg-muted/20 text-xs text-muted-foreground">
                            <td className="py-1 pl-6">
                              <span className="font-mono">{item.gl_code}</span> — {item.description}
                            </td>
                            <td className="text-right py-1">{formatCents(item.budget_amount)}</td>
                            <td className="text-right py-1">—</td>
                            <td className="text-right py-1">{formatCents(item.budget_amount)}</td>
                          </tr>
                        ))}
                    </>
                  );
                })}
                <tr className="font-semibold text-xs border-t-2">
                  <td className="py-2">Total</td>
                  <td className="text-right py-2">{formatCents(sectionBudget)}</td>
                  <td className="text-right py-2">{sectionActual > 0 ? formatCents(sectionActual) : "—"}</td>
                  <td className="text-right py-2">{formatCents(sectionBudget - sectionActual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/treasury/page.tsx components/hoa/CategoryBreakdown.tsx
git commit -m "feat: add treasury overview page with cash, income/expense, and category breakdown"
```

---

## Task 8: Actuals Entry Page

**Files:**
- Create: `app/(dashboard)/treasury/actuals/page.tsx`
- Create: `components/hoa/ActualsForm.tsx`

- [ ] **Step 1: Create `components/hoa/ActualsForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveActuals } from "@/actions/treasury";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { CashBalance } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActualsFormProps {
  fiscalYearId: string;
  categories: CategoryBudgetSummary[];
  latestCashBalance: CashBalance | null;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollarsToCents(value: string): number {
  const n = parseFloat(value.replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/**
 * Form for entering monthly YTD actuals per category and current cash balances.
 * Submits all data atomically via the saveActuals server action.
 */
export function ActualsForm({ fiscalYearId, categories, latestCashBalance }: ActualsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(today);

  // Initialize actuals inputs from latest actuals (or 0)
  const [actuals, setActuals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        `${c.category}:${c.account_type}`,
        c.ytd_actual > 0 ? centsToDisplay(c.ytd_actual) : "",
      ])
    )
  );

  const [operatingBalance, setOperatingBalance] = useState(
    latestCashBalance ? centsToDisplay(latestCashBalance.operating_balance) : ""
  );
  const [reserveBalance, setReserveBalance] = useState(
    latestCashBalance ? centsToDisplay(latestCashBalance.reserve_balance) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const categoryActuals = categories.map((c) => ({
      category: c.category,
      account_type: c.account_type,
      ytd_actual: parseDollarsToCents(actuals[`${c.category}:${c.account_type}`] ?? "0"),
    }));

    startTransition(async () => {
      try {
        await saveActuals(
          fiscalYearId,
          asOfDate,
          categoryActuals,
          parseDollarsToCents(operatingBalance),
          parseDollarsToCents(reserveBalance)
        );
        router.push("/treasury");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const sections = ["operating_income", "operating_expense", "reserve_income", "reserve_expense"] as const;
  const sectionLabel: Record<string, string> = {
    operating_income: "Operating Income",
    operating_expense: "Operating Expense",
    reserve_income: "Reserve Income",
    reserve_expense: "Reserve Expense",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium" htmlFor="asOfDate">
          Report as of
        </label>
        <Input
          id="asOfDate"
          type="date"
          className="w-44"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          required
        />
      </div>

      {sections.map((sectionType) => {
        const sectionCats = categories.filter((c) => c.account_type === sectionType);
        if (sectionCats.length === 0) return null;
        return (
          <div key={sectionType} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {sectionLabel[sectionType]}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">Category</th>
                  <th className="text-right py-1 font-medium">Annual Budget</th>
                  <th className="text-right py-1 font-medium">Prior Entry</th>
                  <th className="text-right py-1 font-medium w-40">YTD Actual</th>
                </tr>
              </thead>
              <tbody>
                {sectionCats.map((cat) => {
                  const key = `${cat.category}:${cat.account_type}`;
                  return (
                    <tr key={key} className="border-b">
                      <td className="py-2">{cat.category}</td>
                      <td className="text-right py-2 text-muted-foreground">
                        ${(cat.budget_amount / 100).toLocaleString()}
                      </td>
                      <td className="text-right py-2 text-muted-foreground">
                        {cat.ytd_actual > 0 ? `$${(cat.ytd_actual / 100).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 pl-4">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={actuals[key] ?? ""}
                          onChange={(e) =>
                            setActuals((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          aria-label={`YTD actual for ${cat.category}`}
                          className="text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cash Balances</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="operatingBalance">Operating Account</label>
            <Input
              id="operatingBalance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={operatingBalance}
              onChange={(e) => setOperatingBalance(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="reserveBalance">Reserve Account</label>
            <Input
              id="reserveBalance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={reserveBalance}
              onChange={(e) => setReserveBalance(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Actuals"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/treasury")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/treasury/actuals/page.tsx`**

```ts
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { ActualsForm } from "@/components/hoa/ActualsForm";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { CategoryActual, BudgetLineItem } from "@/types/database";

export const metadata = { title: "Enter Actuals — Treasury" };

function latestActualsMap(actuals: CategoryActual[]): Map<string, CategoryActual> {
  const map = new Map<string, CategoryActual>();
  for (const a of actuals) {
    const key = `${a.category}:${a.account_type}`;
    if (!map.has(key)) map.set(key, a);
  }
  return map;
}

function buildCategoryBudgets(items: BudgetLineItem[], actualsMap: Map<string, CategoryActual>): CategoryBudgetSummary[] {
  const groups = new Map<string, CategoryBudgetSummary>();
  for (const item of items) {
    const key = `${item.category}:${item.account_type}`;
    if (!groups.has(key)) {
      const actual = actualsMap.get(key);
      groups.set(key, {
        category: item.category,
        account_type: item.account_type,
        budget_amount: 0,
        ytd_actual: actual?.ytd_actual ?? 0,
        as_of_date: actual?.as_of_date ?? null,
        line_items: [],
      });
    }
    const g = groups.get(key)!;
    g.budget_amount += item.budget_amount;
    g.line_items.push(item);
  }
  return Array.from(groups.values());
}

export default async function ActualsPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");

  if (!canEditTreasury(positionResult.data.role, positionResult.data.name)) {
    redirect("/treasury");
  }

  // Get current (most recent) fiscal year
  const fyResult = await supabase
    .from("fiscal_years")
    .select("id, label")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fyResult.data) redirect("/treasury");
  const fy = fyResult.data;

  const [itemsResult, actualsResult, cbResult] = await Promise.all([
    supabase.from("budget_line_items").select("*").eq("fiscal_year_id", fy.id),
    supabase.from("budget_category_actuals").select("*").eq("fiscal_year_id", fy.id).order("as_of_date", { ascending: false }),
    supabase.from("cash_balances").select("*").eq("fiscal_year_id", fy.id).order("as_of_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const actualsMap = latestActualsMap(actualsResult.data ?? []);
  const categories = buildCategoryBudgets(itemsResult.data ?? [], actualsMap);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Enter Actuals — ${fy.label}`}
        subtitle="YTD figures from your Homeside monthly report"
      />
      <SectionCard title="Monthly Entry">
        <ActualsForm
          fiscalYearId={fy.id}
          categories={categories}
          latestCashBalance={cbResult.data ?? null}
        />
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/treasury/actuals/page.tsx components/hoa/ActualsForm.tsx
git commit -m "feat: add treasury actuals entry page and form"
```

---

## Task 9: Budget Management Page

**Files:**
- Create: `app/(dashboard)/treasury/budget/page.tsx`
- Create: `components/hoa/CSVImportDialog.tsx`

- [ ] **Step 1: Create `components/hoa/CSVImportDialog.tsx`**

This component handles the CSV upload → parse → preview → confirm flow entirely client-side.

```tsx
"use client";

import { useState, useRef, useTransition } from "react";
import { parseBudgetCSV, type ParsedBudgetRow, type CSVParseResult } from "@/lib/treasury/csv-parser";
import { importBudget } from "@/actions/treasury";
import { Button } from "@/components/ui/button";

interface CSVImportDialogProps {
  fiscalYearId: string;
  fiscalYearStart: string;
  onSuccess: () => void;
}

type Step = "idle" | "preview" | "importing" | "done";

/**
 * Three-step CSV import: (1) upload and parse, (2) preview parsed rows,
 * (3) confirm and import. Parse errors are shown before any data is written.
 */
export function CSVImportDialog({ fiscalYearId, fiscalYearStart, onSuccess }: CSVImportDialogProps) {
  const [step, setStep] = useState<Step>("idle");
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseBudgetCSV(text, fiscalYearStart);
    setParseResult(result);
    setStep("preview");
  };

  const handleConfirm = () => {
    if (!parseResult) return;
    setImportError(null);
    startTransition(async () => {
      try {
        await importBudget(fiscalYearId, parseResult.rows);
        setStep("done");
        onSuccess();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  const handleReset = () => {
    setStep("idle");
    setParseResult(null);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (step === "idle") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload the Homeside GL CSV export. You will see a preview before anything is saved.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="text-sm"
          aria-label="Choose CSV file"
        />
      </div>
    );
  }

  if (step === "preview" && parseResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{parseResult.rows.length} line items parsed</span>
          {parseResult.skippedCount > 0 && (
            <span className="text-xs text-muted-foreground">{parseResult.skippedCount} rows skipped</span>
          )}
        </div>

        {parseResult.errors.length > 0 && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            <p className="text-sm font-medium text-destructive">Parse warnings</p>
            {parseResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2 font-medium">GL Code</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-right p-2 font-medium">Budget</th>
              </tr>
            </thead>
            <tbody>
              {parseResult.rows.map((row: ParsedBudgetRow) => (
                <tr key={row.gl_code} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{row.gl_code}</td>
                  <td className="p-2">{row.description}</td>
                  <td className="p-2">{row.category}</td>
                  <td className="p-2">{row.account_type}</td>
                  <td className="p-2 text-right">${(row.budget_amount / 100).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {importError && <p className="text-sm text-destructive">{importError}</p>}

        <div className="flex gap-3">
          <Button onClick={handleConfirm} disabled={isPending || parseResult.rows.length === 0}>
            {isPending ? "Importing…" : `Import ${parseResult.rows.length} rows`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Choose Different File
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-600 font-medium">Import complete.</p>
        <Button variant="outline" onClick={handleReset}>Import Another File</Button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Create `app/(dashboard)/treasury/budget/page.tsx`**

```ts
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury, isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CSVImportDialog } from "@/components/hoa/CSVImportDialog";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { approveBudget, createFiscalYear, initializeAssessments } from "@/actions/treasury";
import type { AppStatus } from "@/components/hoa/StatusBadge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Budget — Treasury" };

export default async function BudgetPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;

  if (!canEditTreasury(position.role, position.name)) redirect("/treasury");

  const fyResult = await supabase
    .from("fiscal_years")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fy = fyResult.data;

  const lineItemsResult = fy
    ? await supabase
        .from("budget_line_items")
        .select("id, gl_code, description, category, account_type, budget_amount")
        .eq("fiscal_year_id", fy.id)
        .order("category")
    : null;

  const lineItems = lineItemsResult?.data ?? [];
  const canApprove = isAdmin(position.role) && fy?.status === "draft";
  const isDraft = fy?.status === "draft";

  async function handleApprove() {
    "use server";
    if (fy) await approveBudget(fy.id);
  }

  async function handleInitAssessments() {
    "use server";
    if (fy) await initializeAssessments(fy.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Management"
        subtitle={fy ? `${fy.label} · ${fy.start_date} to ${fy.end_date}` : "No fiscal year set up"}
      />

      {fy && (
        <SectionCard
          title={
            <span className="flex items-center gap-3">
              {fy.label}
              <StatusBadge status={fy.status as AppStatus} />
            </span>
          }
        >
          <p className="text-sm text-muted-foreground">
            Default assessment: ${(fy.default_assessment_amount / 100).toLocaleString()}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {canApprove && (
              <form action={handleApprove}>
                <Button type="submit" variant="outline">
                  Approve Budget (lock from re-import)
                </Button>
              </form>
            )}
            <form action={handleInitAssessments}>
              <Button type="submit" variant="outline">
                Initialize Assessments
              </Button>
            </form>
          </div>
        </SectionCard>
      )}

      {isDraft && fy && (
        <SectionCard title="Import CSV Budget">
          <CSVImportDialog
            fiscalYearId={fy.id}
            fiscalYearStart={fy.start_date}
            onSuccess={() => {}}
          />
        </SectionCard>
      )}

      {lineItems.length > 0 && (
        <SectionCard title={`GL Line Items (${lineItems.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-2 font-medium">GL Code</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30 text-sm">
                    <td className="p-2 font-mono text-xs">{item.gl_code}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2">{item.category}</td>
                    <td className="p-2 text-xs text-muted-foreground">{item.account_type}</td>
                    <td className="p-2 text-right">${(item.budget_amount / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!fy && (
        <SectionCard title="Create Fiscal Year">
          <p className="text-sm text-muted-foreground mb-4">
            No fiscal year exists yet. ESL fiscal year runs April 1 – March 31.
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const label = formData.get("label") as string;
              const startDate = formData.get("start_date") as string;
              const endDate = formData.get("end_date") as string;
              const amountDollars = parseFloat(formData.get("assessment") as string);
              await createFiscalYear(label, startDate, endDate, Math.round(amountDollars * 100));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="label">Label (e.g. FY26)</label>
                <input id="label" name="label" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="assessment">Annual Assessment ($)</label>
                <input id="assessment" name="assessment" type="number" step="0.01" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="start_date">Start Date</label>
                <input id="start_date" name="start_date" type="date" required defaultValue="2025-04-01" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="end_date">End Date</label>
                <input id="end_date" name="end_date" type="date" required defaultValue="2026-03-31" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <Button type="submit">Create Fiscal Year</Button>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

Expected: no errors. If `StatusBadge` doesn't accept `'draft'` or `'approved'` as `AppStatus`, add them to the union in `components/hoa/StatusBadge.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/treasury/budget/page.tsx components/hoa/CSVImportDialog.tsx
git commit -m "feat: add treasury budget management page with CSV import"
```

---

## Task 10: Export New Components

**Files:**
- Modify: `components/hoa/index.ts`

- [ ] **Step 1: Add new component exports**

In `components/hoa/index.ts`, add:

```ts
export { CategoryBreakdown } from "./CategoryBreakdown";
export { ActualsForm } from "./ActualsForm";
export { CSVImportDialog } from "./CSVImportDialog";
export { AssessmentEditPanel } from "./AssessmentEditPanel";
```

Note: `AssessmentEditPanel` will be created in Task 11. Add the export now so the file is ready.

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

If it fails on `AssessmentEditPanel`, temporarily remove that export and add it back in Task 11.

- [ ] **Step 3: Commit**

```bash
git add components/hoa/index.ts
git commit -m "feat: export new treasury components from hoa/index"
```

---

## Task 11: Properties Assessment Integration

**Files:**
- Create: `components/hoa/AssessmentEditPanel.tsx`
- Modify: `app/(dashboard)/properties/page.tsx`
- Modify: `components/hoa/PropertiesView.tsx`

- [ ] **Step 1: Create `components/hoa/AssessmentEditPanel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateAssessmentPayment } from "@/actions/treasury";
import type { AssessmentPayment, AssessmentStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssessmentEditPanelProps {
  payment: AssessmentPayment;
  onClose: () => void;
}

/**
 * Inline edit panel for a single assessment payment row.
 * Renders as an expanded section below the property row.
 */
export function AssessmentEditPanel({ payment, onClose }: AssessmentEditPanelProps) {
  const [status, setStatus] = useState<AssessmentStatus>(payment.status);
  const [amountPaid, setAmountPaid] = useState((payment.amount_paid / 100).toFixed(2));
  const [paymentReference, setPaymentReference] = useState(payment.payment_reference ?? "");
  const [paidAt, setPaidAt] = useState(payment.paid_at ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    const cents = Math.round(parseFloat(amountPaid.replace(/[$,]/g, "")) * 100);
    startTransition(async () => {
      try {
        await updateAssessmentPayment(
          payment.id,
          status,
          isNaN(cents) ? 0 : cents,
          paymentReference || null,
          paidAt || null,
          notes || null
        );
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div className="bg-muted/30 border-t px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as AssessmentStatus)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Amount Paid ($)</label>
          <Input
            className="h-8 text-sm"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Payment Reference</label>
          <Input
            className="h-8 text-sm"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Check #, etc."
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date Paid</label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <Input
          className="text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Amount due: ${(payment.amount_due / 100).toLocaleString()}
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/(dashboard)/properties/page.tsx`**

Update the page to also fetch the current fiscal year's assessment payments and the position's edit permissions, then pass them to `PropertiesView`:

```ts
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { PropertiesView } from "@/components/hoa/PropertiesView";

export const metadata = {
  title: "Properties — HOA Board",
};

/**
 * Properties table page.
 * Fetches all properties and the current fiscal year's assessment payments.
 * Restricted to voting members; chairs are redirected.
 */
export default async function PropertiesPage() {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;
  if (isChair(position.role)) redirect("/dashboard");

  const canEditAssessments = canEditTreasury(position.role, position.name);

  // Fetch properties and current fiscal year in parallel
  const [propertiesResult, fyResult] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, has_annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor"
      )
      .order("lot_number"),
    supabase
      .from("fiscal_years")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lots = propertiesResult.data ?? [];
  const currentFYId = fyResult.data?.id ?? null;

  // Fetch assessment payments for the current fiscal year (if one exists)
  const assessmentsResult = currentFYId
    ? await supabase
        .from("assessment_payments")
        .select("*")
        .eq("fiscal_year_id", currentFYId)
    : null;

  const assessments = assessmentsResult?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Neighborhood lots and membership information"
      />
      <PropertiesView
        lots={lots}
        assessments={assessments}
        canEditAssessments={canEditAssessments}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update `components/hoa/PropertiesView.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import type { Property, AssessmentPayment, AssessmentStatus } from "@/types/database";
import type { MapFilters } from "@/types/domain";
import { filterProperties } from "@/lib/map";
import { PropertyTable } from "./PropertyTable";
import { AssessmentEditPanel } from "./AssessmentEditPanel";
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

function sayorToString(sayor: boolean | null): string {
  if (sayor === null) return "all";
  return sayor ? "true" : "false";
}

function stringToSayor(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

const STATUS_BADGE_CLASS: Record<AssessmentStatus, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
  unpaid: "bg-red-100 text-red-800",
  waived: "bg-gray-100 text-gray-600",
};

interface PropertiesViewProps {
  lots: Property[];
  assessments: AssessmentPayment[];
  canEditAssessments: boolean;
}

/**
 * Filterable property table with assessment payment status columns.
 * Clicking a row when assessments are loaded expands an edit panel (canEditAssessments only).
 */
export function PropertiesView({ lots, assessments, canEditAssessments }: PropertiesViewProps) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [statusFilter, setStatusFilter] = useState<AssessmentStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setStatusFilter("all");
  }, []);

  const assessmentByPropertyId = useMemo(
    () => new Map(assessments.map((a) => [a.property_id, a])),
    [assessments]
  );

  const hasActiveFilter =
    filters.membership !== "" || filters.sayor !== null || filters.lotSearch !== "" || statusFilter !== "all";

  let filteredLots = useMemo(
    () => filterProperties(lots, filters, null),
    [lots, filters]
  );

  if (statusFilter !== "all" && assessments.length > 0) {
    filteredLots = filteredLots.filter((lot) => {
      const ap = assessmentByPropertyId.get(lot.id);
      return ap?.status === statusFilter;
    });
  }

  const membershipTypes = useMemo(
    () =>
      Array.from(new Set(lots.map((l) => l.membership_type).filter(Boolean))).sort() as string[],
    [lots]
  );

  const hasAssessments = assessments.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.membership === "" ? "all" : filters.membership}
          onValueChange={(v: string | null) =>
            setFilters((f) => ({ ...f, membership: v === "all" || v === null ? "" : v }))
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
          onValueChange={(v: string | null) =>
            setFilters((f) => ({ ...f, sayor: stringToSayor(v ?? "all") }))
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

        {hasAssessments && (
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as AssessmentStatus | "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Input
          className="w-32"
          placeholder="Lot #"
          value={filters.lotSearch}
          onChange={(e) => setFilters((f) => ({ ...f, lotSearch: e.target.value }))}
          aria-label="Search by lot number"
        />

        <Button variant="outline" onClick={handleReset} disabled={!hasActiveFilter}>
          Show All
        </Button>
      </div>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left p-2 font-medium">Lot</th>
              <th className="text-left p-2 font-medium">Name</th>
              <th className="text-left p-2 font-medium">Address</th>
              <th className="text-left p-2 font-medium">Membership</th>
              {hasAssessments && (
                <>
                  <th className="text-left p-2 font-medium">Assessment</th>
                  <th className="text-right p-2 font-medium">Paid</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredLots.map((lot) => {
              const ap = assessmentByPropertyId.get(lot.id);
              const isExpanded = expandedId === lot.id;
              return (
                <>
                  <tr
                    key={lot.id}
                    onClick={() => {
                      if (hasAssessments && ap && canEditAssessments) {
                        setExpandedId(isExpanded ? null : lot.id);
                      }
                    }}
                    className={`border-b ${hasAssessments && ap && canEditAssessments ? "cursor-pointer hover:bg-muted/40" : ""} ${isExpanded ? "bg-muted/20" : ""}`}
                  >
                    <td className="p-2">{lot.lot_number}</td>
                    <td className="p-2">{[lot.first_name, lot.last_name].filter(Boolean).join(" ")}</td>
                    <td className="p-2">{lot.street_address ?? "—"}</td>
                    <td className="p-2">{lot.membership_type ?? "—"}</td>
                    {hasAssessments && (
                      <>
                        <td className="p-2">
                          {ap ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[ap.status]}`}>
                              {ap.status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {ap && ap.amount_paid > 0
                            ? `$${(ap.amount_paid / 100).toLocaleString()}`
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                  {isExpanded && ap && (
                    <tr key={`${lot.id}-panel`}>
                      <td colSpan={hasAssessments ? 6 : 4} className="p-0">
                        <AssessmentEditPanel
                          payment={ap}
                          onClose={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filteredLots.length === 0 && (
              <tr>
                <td colSpan={hasAssessments ? 6 : 4} className="p-6 text-center text-muted-foreground text-sm">
                  No properties match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filteredLots.length} of {lots.length} properties shown</p>
    </div>
  );
}
```

- [ ] **Step 4: Run type-check and tests**

```bash
pnpm type-check && pnpm test
```

Expected: no type errors, all 128+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/hoa/AssessmentEditPanel.tsx app/(dashboard)/properties/page.tsx components/hoa/PropertiesView.tsx
git commit -m "feat: add assessment payment status columns and inline edit to Properties page"
```

---

## Task 12: StatusBadge — Add Treasury Statuses

The budget page uses `<StatusBadge status={fy.status as AppStatus} />`. Check whether `draft` and `approved` are in the `AppStatus` union. If not:

**Files:**
- Modify: `components/hoa/StatusBadge.tsx`

- [ ] **Step 1: Check the current AppStatus type**

Open `components/hoa/StatusBadge.tsx` and find the `AppStatus` type definition.

- [ ] **Step 2: Add missing statuses if needed**

If `draft` and `approved` are not in `AppStatus`, add them and add their color cases in the variant map:

```ts
// In the AppStatus type union, add:
| "draft"
| "approved"

// In the variant map, add:
draft: "bg-yellow-100 text-yellow-800",
approved: "bg-green-100 text-green-800",
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

- [ ] **Step 4: Commit if changed**

```bash
git add components/hoa/StatusBadge.tsx
git commit -m "feat: add draft and approved to StatusBadge AppStatus"
```

---

## Task 13: Update docs/specs/README.md

**Files:**
- Modify: `docs/specs/README.md`

- [ ] **Step 1: Update the treasury row status**

Change:

```
| Treasury Dashboard | Not started — spec in progress | High |
```

To:

```
| Treasury Dashboard | In progress — see plan at `docs/superpowers/plans/2026-06-12-treasury-dashboard.md` | High |
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/README.md
git commit -m "docs: mark treasury dashboard as in progress"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Cash on hand card (Operating / Reserve) | Task 7 |
| Income YTD vs budget | Task 7 |
| Expense YTD vs budget | Task 7 |
| Assessment strip with paid/unpaid counts | Task 7 |
| Category breakdown with expandable GL rows | Task 7 (CategoryBreakdown) |
| `/treasury/actuals` — category entry form | Task 8 |
| Cash balance entry on actuals page | Task 8 |
| `/treasury/budget` — CSV import | Task 9 |
| Approve budget action (president) | Task 9 |
| Create fiscal year form | Task 9 |
| Initialize assessments action | Task 5 + Task 9 |
| Homeside GL CSV parser with validation | Task 4 |
| Assessment columns on Properties page | Task 11 |
| Inline edit panel for assessment payments | Task 11 |
| canEditTreasury permission | Task 3 |
| RLS policies for all new tables | Task 1 |
| Fiscal year workflow (draft → import → approve) | Tasks 1, 5, 9 |
| Historical fiscal year selector | Not built — noted as future enhancement |
| Recharts bar chart | Not built — deferred; CategoryBreakdown uses a plain table which fulfills the spec's data requirement |

**Deferred items (non-blocking):**
- Recharts bar chart on the overview page — the category breakdown table gives the same data. Add recharts as a follow-up if desired.
- Fiscal year selector for historical views — the pages currently show the most recent year. Add a `?fy=<id>` search param in a follow-up.

**Placeholder scan:** No TBD, TODO, or "implement later" language found.

**Type consistency check:**
- `CategoryBudgetSummary` defined in Task 2, used in Tasks 7, 8 — matches.
- `AssessmentPayment` used in Task 11 — matches database.ts Row type.
- `saveActuals` parameters in `actions/treasury.ts` match `ActualsForm`'s call signature — matches.
- `parseBudgetCSV` return type `CSVParseResult` used in `CSVImportDialog` — matches.
- `canEditTreasury` called with `(position.role, position.name)` everywhere — matches signature.
