# Treasury Dashboard — Design Spec

**Date:** 2026-06-03  
**Requested by:** Michelle Mulcahey (Treasurer)  
**Status:** Design approved, awaiting implementation plan

---

## Problem

The treasurer currently works from Homeside's monthly PDF reports and a shared spreadsheet. Two gaps:

1. **No visual summary** — Homeside's reports are solid but not visual, making it hard to share financial health quickly with the full board.
2. **No intra-period lookups** — Between monthly reports, the treasurer can't answer "has Mr. Smith paid his dues?" without calling Homeside.

The spreadsheet has a corruption risk (too many editors, no access controls).

---

## Approach

**Approach C: CSV import for annual budget, manual category-level entry for monthly actuals.**

- Import the annual budget CSV from Homeside once per fiscal year (storing GL codes and amounts)
- Treasurer enters YTD actuals at the category level (~8–10 inputs per month, ~10 minutes)
- Dashboard displays visual summary for all board members
- Per-homeowner assessment tracking integrated into the existing Properties page
- Data model is designed to support GL-level actuals import in a future phase (see Upgrade Path)

---

## Fiscal Year

ESL's fiscal year runs **April 1 – March 31**. FY26 = April 2025 – March 2026.

---

## Data Model

### `fiscal_years`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| label | text | e.g. "FY26" |
| start_date | date | April 1 |
| end_date | date | March 31 |
| default_assessment_amount | integer | Cents. Per-property default for dues |
| status | text | `draft` \| `approved` |
| created_at | timestamptz | |

On creation, automatically seeds `assessment_payments` rows for all active properties using `default_assessment_amount`.

### `budget_line_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| fiscal_year_id | uuid | FK → fiscal_years |
| gl_code | text | e.g. "40-4000-00" |
| description | text | e.g. "Member Assessment" |
| category | text | e.g. "G&A", "Landscape", "Pool" |
| account_type | text | `operating_income` \| `operating_expense` \| `reserve_income` \| `reserve_expense` |
| budget_amount | integer | Cents, annual total |

Unique constraint on `(fiscal_year_id, gl_code)`.

### `budget_monthly_amounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| budget_line_item_id | uuid | FK → budget_line_items |
| month_start | date | First day of the month (e.g. 2025-04-01) |
| amount | integer | Cents |

Unique constraint on `(budget_line_item_id, month_start)`. Normalized alternative to JSONB — enables SQL aggregation by month, quarter, or any date range without fiscal-year-specific mapping logic.

### `budget_category_actuals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| fiscal_year_id | uuid | FK → fiscal_years |
| category | text | Must match a category in budget_line_items |
| account_type | text | Same enum as budget_line_items |
| as_of_date | date | Date the actuals are through |
| ytd_actual | integer | Cents, year-to-date |
| entered_by_position_id | uuid | FK → positions |
| entered_at | timestamptz | |

Unique constraint on `(fiscal_year_id, category, account_type, as_of_date)`. Upsert on conflict — one canonical record per category per date.

### `cash_balances`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| fiscal_year_id | uuid | FK → fiscal_years |
| as_of_date | date | |
| operating_balance | integer | Cents |
| reserve_balance | integer | Cents |
| entered_by_position_id | uuid | FK → positions |
| entered_at | timestamptz | |

Latest record by `as_of_date` is the current balance.

### `assessment_payments` (extends existing `properties` table)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| property_id | uuid | FK → properties |
| fiscal_year_id | uuid | FK → fiscal_years |
| status | text | `paid` \| `partial` \| `unpaid` \| `waived` |
| amount_due | integer | Cents, set at row creation from fiscal_year.default_assessment_amount |
| amount_paid | integer | Cents |
| payment_reference | text | Check number, online payment ID, etc. |
| paid_at | date | |
| notes | text | |
| entered_by_position_id | uuid | FK → positions |
| entered_at | timestamptz | |

Unique constraint on `(property_id, fiscal_year_id)`.

---

## Permissions

New function `canEditTreasury(role, positionName)` in `lib/permissions.ts`:

```ts
export function canEditTreasury(role: Role, positionName: string): boolean {
  return role === 'president' || role === 'officer' || positionName === 'Treasurer';
}
```

**Read:** All authenticated users (all voting members + committee chairs).  
**Write:** President, VP, Secretary, Treasurer only.

Note: Officers (VP + Secretary) have edit rights by explicit request — this is a policy decision, not a default.

---

## Routes

| Route | Description | Edit access |
|---|---|---|
| `/treasury` | Overview dashboard | View all; edit prompt for canEditTreasury |
| `/treasury/actuals` | Monthly actuals + cash balance entry form | canEditTreasury only |
| `/treasury/budget` | Budget management + CSV import | canEditTreasury only |

Assessment tracking integrates into the existing `/properties` page — no separate treasury route.

---

## Pages

### `/treasury` — Overview Dashboard

**Cash on Hand card** (top, prominent):
- Operating: $X | Reserve: $Y — as of [date]
- If no balance entered: prompt to add one (canEditTreasury only)

**Income card:**
- YTD collected vs annual budget, amount remaining to collect, % progress bar

**Expenses card:**
- YTD spent vs annual budget, amount remaining to spend, % progress bar

**Assessments strip:**
- X of Y members paid · $Z collected · $W outstanding — links to `/properties?status=unpaid` filtered view

**Category breakdown:**
- Horizontal bar chart (Recharts) per account section (Operating / Reserve)
- Table below: category | budget | YTD actual | remaining | % bar
- Expandable rows: click category to see individual GL line items with budget amounts
- GL-level actuals show "—" in Phase 1; populated in Phase 2

**Fiscal year selector** in page header for historical views (read-only for prior years).

---

### `/treasury/actuals` — Monthly Entry Form

- "Report as of [date]" date picker at top
- Two sections: Operating / Reserve
- One row per category: budget (read-only) | last entered (read-only, greyed) | new YTD input
- Cash balance inputs: Operating account | Reserve account
- Single submit saves all actuals + cash balance atomically
- Redirects to `/treasury` on success
- Entry history table below the form: who entered, as of what date, summary totals

---

### `/treasury/budget` — Budget Management

- Current fiscal year shown with status badge (draft | approved)
- GL line items grouped by category, with budget amounts
- "Import CSV" button (canEditTreasury) → upload dialog → parsed preview table → confirm
- "Approve Budget" action (president only) → locks budget from further import; status → approved
- Fiscal year selector for historical viewing (read-only)

**CSV parser rules (Homeside GL format):**
- Skip rows where the GL code column doesn't match `\d{2}-\d{4}-\d{2}`
- Derive category from the most recent non-GL section header row
- Derive account_type from section context: "Operating Accounts" vs "Reserve Accounts" + "Income Accounts" vs "Expense Accounts"
- Budget amount: "2026 Budget" column (or equivalent year column)
- Monthly amounts: 12 month columns (Apr–Mar)
- Show validation errors and unrecognized rows in the preview before confirming
- Import is a transaction — all or nothing

---

### `/properties` — Assessment Integration

Adds to the existing properties table view:
- Assessment status column: badge (Paid / Partial / Unpaid / Waived)
- Amount paid / Amount due columns (visible to voting members)
- Filter tab: add "Unpaid" filter option
- Inline edit panel on row click (canEditTreasury): status, amount paid, payment reference, paid date, notes
- "Initialize FY[XX] Assessments" action: creates `assessment_payments` rows for all active properties using `fiscal_year.default_assessment_amount`

---

## Upgrade Path: GL-Level Actuals (Phase 2)

When Homeside provides CSV actuals exports:

1. Add `budget_gl_actuals` table: `budget_line_item_id`, `as_of_date`, `ytd_actual`, unique on `(budget_line_item_id, as_of_date)`
2. Add "Import Actuals CSV" to `/treasury/actuals`
3. Dashboard computes category totals from `budget_gl_actuals` grouped by category — same display, now derived from GL data
4. Drill-down rows on dashboard show real GL-level actuals vs budget
5. `budget_category_actuals` manual entry remains as fallback for categories not in the import

No migration required on budget side — `budget_line_items` already stores GL codes.

---

## Fiscal Year Workflow

1. President (or Treasurer) creates new fiscal year with `default_assessment_amount` and `status = draft`
2. Treasurer imports budget CSV → previews → confirms
3. System seeds `assessment_payments` for all active properties
4. President approves budget → `status = approved`, budget locked from re-import
5. Treasurer enters monthly actuals throughout the year
6. At year end, fiscal year is read-only; new fiscal year created for next cycle

---

## Out of Scope (This Spec)

- Operating calendar of key annual dates and deliverables — see [README](../specs/README.md)
- GL-level actuals import (Phase 2 upgrade path documented above)
- Homeside real-time integration
- Homeowner-facing financial reporting (public visibility)
- Motions or formal budget approval workflow beyond president approval flag
