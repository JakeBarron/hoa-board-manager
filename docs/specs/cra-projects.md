# CRA Projects

Capital Reserve Analysis project tracker. An **execution tracker** — each project is a unit of capital work the board is managing (estimate → quotes → vendor selection → actual cost), not a budget planner. Treasury remains the source of truth for the reserve budget; this feature links to it loosely now and integrates more deeply later.

## Status
Schema partially exists (migration 0001): `cra_projects`, `cra_quotes`, `cra_updates`, `cra_documents`. List page and new page are `EmptyState`/placeholder stubs; there is no `/cra/[id]`. This spec adds columns + RLS (migration 0022), builds all three pages, and widens edit access to the CRA chair.

Design settled via `/grill-me` on 2026-06-17, then stress-tested by adversarial review (findings folded in below).

---

## Scope & guiding decisions

- **Execution tracker, not a budget planner** (decision A). The board's CapEx budget doc (grouped categories with subtotals + grand total) was the *inspiration*, but `/cra` tracks individual projects as cards. Treasury (`fiscal_years`, `budget_line_items`) stays authoritative for the reserve budget.
- **Estimated + actual cost.** Keep the existing `estimated_cost` as the initial estimate (from the assessor's reserve study); add `actual_cost` recorded after the work.
- **Money is stored as integer cents** (decision after review) to match treasury (`budget_amount`, `default_assessment_amount`, `amount_due` are all integer cents — `treasury/page.tsx:20` `formatCents = cents/100`). The existing `cra` money columns are `numeric(12,2)` dollars; since the cra_* tables are **empty** in e2e + prod, migration 0022 changes them to `integer` cents. Reuse `parseCents`/`formatCents` (treasury `csv-parser.ts:164` / `treasury/page.tsx:20`). This makes the future treasury join clean (no 100× conversion bug).
- **Future treasury integration** is a stated goal but out of scope for v1. The hard FK to `fiscal_years` and the cents representation are chosen so that integration is a trivial join later.

---

## Data model (migration 0022)

> **Precondition (verified):** all four `cra_*` tables are empty — no seed or script inserts CRA rows. The `not null` ALTER on `cra_updates.created_by` and the dollars→cents type changes are only safe on empty tables. The migration must be run after confirming `select count(*) from cra_updates = 0` (and same for the others).

### `cra_projects`

Existing: `id`, `name`, `description`, `status`, `estimated_cost`, `created_by`, `created_at`, `updated_at`.

Changes:
| Column | Type | Notes |
|---|---|---|
| `estimated_cost` | **change `numeric(12,2)` → `integer`** | Now integer cents. Empty table, safe. |
| `actual_cost` | `integer` nullable (new) | Integer cents; recorded after the work; suggested from the selected quote's amount |
| `target_date` | `date` nullable (new) | "Aim to complete by"; overdue cue if past and status ≠ `complete` |
| `fiscal_year_id` | `uuid references fiscal_years(id)` nullable (new) | FK chosen for future treasury integration; nullable for unassigned ("someday") projects |
| `category` | `text` nullable (new) | Free text (e.g. "Lake Maintenance"); shown as a tag; suggested via `<datalist>` of existing values |
| `priority` | `text check (priority in ('high','medium','low'))` nullable (new) | Drives default list sort |

- `status` enum unchanged: `proposed → approved → in_progress → complete | on_hold`.
- No `progress_pct` — status is the sole lifecycle/progress signal.

### `cra_quotes`

Existing: `id`, `project_id`, `vendor_name`, `amount`, `notes`, `document_url`, `created_at`.

Changes:
| Column | Type | Notes |
|---|---|---|
| `amount` | **change `numeric(12,2)` → `integer`** | Integer cents. Empty table, safe. |
| `contact_name` | `text` nullable (new) | Point of contact |
| `contact_phone` | `text` nullable (new) | Phone (text — formatting/extensions) |
| `contact_email` | `text` nullable (new) | |
| `is_selected` | `boolean not null default false` (new) | Marks chosen vendor; at-most-one enforced in the server action (see below) |

- `amount` = quoted dollar cost (cents). `document_url` may hold a storage path or pasted URL.
- Quotes are fully mutable: editable + deletable by `canEditCRA` users (confirm on delete). No `updated_at` column (skip "last edited" for v1).

### `cra_updates` — authorship fix

Existing `created_by_position text` has a check constraint (`0002:10`) listing `('president','vp','secretary','treasurer','pool','membership','tennis','social')` — **excludes `cra`**, so the CRA chair literally cannot insert. Replace it:

```sql
alter table cra_updates drop column created_by_position;        -- drops its check constraint too
alter table cra_updates add column created_by uuid not null references positions(id);
```

- Safe only because the table is empty (precondition above). If ever non-empty, add the column nullable + backfill instead.
- Log stays **immutable** (insert-only; no edit/delete UI/policy). The `addUpdate` action resolves the current user's position id server-side and sets `created_by`.

### `cra_documents` — unchanged

`url_type` (`google_doc` | `storage_file`) already distinguishes pasted URL from uploaded file.

---

## RLS — the critical part (migration 0022)

> **Adversarial review's #1 finding.** Migration `0003` gates all CRA writes to `is_officer_or_above()` (= `role in ('president','officer')` only). So today: the `cra` chair is **denied every write at the DB layer**, and there are **no DELETE policies** and **no `cra_quotes` UPDATE policy** anywhere — meaning delete-project, edit-quote, select-quote, delete-document are denied for *everyone*. App-layer `canEditCRA` is irrelevant if RLS blocks the write. Migration 0022 must fix this at the DB layer.

**1. Add an editor helper** (mirrors `is_treasury_editor()` at `0018:89`):
```sql
create or replace function is_cra_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
      and (role in ('president','officer') or name = 'cra')
  );
$$;
```

**2. Replace the existing officer-only write policies and add the missing ones.** Final policy set per table (SELECT for all authenticated stays as-is):

| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `cra_projects` | `is_cra_editor()` | `is_cra_editor()` | `is_cra_editor()` (new) |
| `cra_quotes` | `is_cra_editor()` | `is_cra_editor()` (new) | `is_cra_editor()` (new) |
| `cra_updates` | `is_cra_editor()` | — (immutable, no policy) | — (immutable, no policy) |
| `cra_documents` | `is_cra_editor()` | — (not edited) | `is_cra_editor()` (new) |

Drop the old `cra_projects_insert/update`, `cra_quotes_insert`, `cra_updates_insert`, `cra_docs_insert` policies (gated on `is_officer_or_above()`) and recreate them with `is_cra_editor()`. `on delete cascade` FKs already clean child rows on project delete, but the parent DELETE still needs its policy.

> **RLS is not Jest-testable.** These policies must be verified manually against e2e Supabase by signing in as the CRA chair and confirming create/edit/delete works, and as a `member` confirming writes are denied.

---

## Permissions (app layer)

- **`canEditCRA(role, positionName)`** = `president || officer || positionName === 'cra'`. This is a **breaking signature change** from the current single-arg `canEditCRA(role)` (`permissions.ts:48`). Make `positionName` required, matching `canEditTreasury(role, positionName)`.
  - **Callers to update:** the only current callers are 4 assertions in `lib/permissions.test.ts:48-56` (the `/cra` stubs do *not* call it). Update those tests; new pages pass `position.name` (they already `select("id, name, role")`).
- **Route guard:** there is no central role gate — guards are per-page (`proxy.ts`/layout only handle auth). The current stubs redirect chairs (`cra/page.tsx:26` `if (isChair(role)) redirect(...)`). The new pages must **drop the blanket chair redirect** and instead allow the `cra` chair: read `position.name` and only redirect chairs whose name ≠ `cra`. Read-only access for everyone authenticated; edit gated by `canEditCRA`.
- **Delete a project:** any `canEditCRA` user, behind an "are you sure" confirm (`InlineConfirm`).

---

## Pages

### `/cra` — Project list (stacked cards)

- **Stacked cards** (`CRAProjectCard`, net-new — the app otherwise uses tables; this is a deliberate new idiom), click a card → `/cra/[id]`.
- **Two tabs** (net-new small client component — no tab primitive exists in `components/ui/`; a `useState` toggle over two filtered lists, like `/meetings`' two sections):
  - **Open** — statuses in shared `OPEN_STATUSES` = `['proposed','approved','in_progress','on_hold']`
  - **Complete** — `complete`
- **Default sort** (within Open): `priority` high → medium → low → none, then `target_date` ascending (nulls last); `on_hold` sinks within Open. Pure comparator, unit-tested.
- **Summary bar:** count + estimated total + actual spent for the selected fiscal year.
- **Filters:** fiscal year (defaults to most-recent — `order by start_date desc limit 1`, matching treasury `treasury/page.tsx:49`), status, category.
- **Card:** name, status badge (`StatusBadge` already supports all CRA statuses), category tag, priority, estimated cost (and actual if set, via `formatCents`), target date + overdue cue, "X/3 quotes" readiness (amber < 3, green ≥ 3).
- **New Project** button for `canEditCRA` users.

### `/cra/new` — Create project

- **Access:** officers + CRA chair (redirect others to `/cra`).
- **Required:** `name`, `estimated_cost` (entered in dollars, converted to cents via `parseCents`).
  - Helper text under the estimate field, interpolating the `hoa_name` setting:
    > *"Refer to the Updated Capital Reserve Analysis for {hoa_name} for the initial estimate."*
- **Optional:** description, category (text input + `<datalist>` of existing categories), priority, target_date, fiscal_year_id (defaults to most-recent FY, clearable).
- **Status** defaults to `proposed`. Server action `createCRAProject` in `actions/cra.ts`.

### `/cra/[id]` — Project detail

Inline-editable (net-new inline-edit components — `SettingRow`/`AssessmentEditPanel` are domain-hardwired and `PositionEditRow` does not exist, so **copy the inline-save pattern**, don't import them). Read-only users see values only.

**Header** — name, status (dropdown saving on change), estimated/actual cost (cents↔dollars via parse/format), target date, priority, category, fiscal year, created-by, dates. Click-to-edit for `canEditCRA`.

**Quotes** — inline add form; each quote editable + deletable (`InlineConfirm`). Fields: vendor, amount (dollars→cents), contact name/phone/email, notes, document (upload or URL). `is_selected` toggle marks the winner — `selectQuote` sets the chosen quote true and clears the others (two ordered writes; action-level is sufficient for a 13-member board, no DB index). Selecting suggests its amount as `actual_cost`. Soft "**X of 3**" readiness — no hard block.

**Status updates log** — chronological, immutable; "Add update" textarea (`canEditCRA`); `created_by` resolved server-side, displayed as the author's position name.

**Documents** — `FileUploadButton` → `documents` bucket (signed-URL downloads, as in `/architecture/new`, `/documents`) **or** paste a URL; `url_type` records which.

---

## Navigation & dashboard

- **Sidebar (`Sidebar.tsx`):** "CRA Projects" → `/cra` is **already present** in `FUNCTION_NAV` for voting members — no change there. The **chair branch** (`Sidebar.tsx:56-72`) is a hardcoded minimal list that must be special-cased: add the CRA link **only when `positionName === 'cra'`** (not for other chairs). Add a `Sidebar.test.tsx` case asserting the `cra` chair sees it and other chairs don't.
- **CRA chair:** keeps `/committee/cra` as their My Office (pre-meeting form) **and** gets the `/cra` link. They can edit because `canEditCRA` + `is_cra_editor()` include the `cra` position.
- **Dashboard "Active CRA Projects" card** (`dashboard/page.tsx:41`): currently filters `['proposed','approved','in_progress']` — **diverges** from the Open tab (which adds `on_hold`). Extract a shared `OPEN_STATUSES` constant and use it in both so they can't drift.

---

## Implementation notes

- **Migration 0022** (`supabase/migrations/0022_cra_projects.sql`): type changes (dollars→cents) on `cra_projects.estimated_cost` + `cra_quotes.amount`; new project/quote columns; `cra_updates` authorship swap; `is_cra_editor()` helper; full insert/update/delete RLS policy set. Run only after confirming the cra_* tables are empty.
- **Types (`types/database.ts`):** keep `Relationships: []` on all four (already present). Real work: change money types to `number` (cents); add the new columns to `cra_projects` Row/Insert/Update; widen `cra_quotes` Update (currently only `{notes, document_url}`) to include `is_selected`/`amount`/`vendor_name`/contacts; rename `cra_updates` `created_by_position` → `created_by`; add `export type CRAPriority = 'high' | 'medium' | 'low'`. `CRAProjectDetail` in `domain.ts` already pre-loads quotes/updates/documents.
- **Server actions (`actions/cra.ts`):** `createCRAProject`, `updateCRAProject`, `deleteCRAProject`, `addQuote`, `updateQuote`, `deleteQuote`, `selectQuote`, `addUpdate`, `addDocument`, `deleteDocument`. Each resolves the caller's position, checks `canEditCRA` for a clear error, then writes (RLS is the real enforcement).
- **Shared constant:** `OPEN_STATUSES` (used by `/cra` tabs + dashboard card).
- **Standards:** TDD (tests first), JSDoc on every export, functions do one thing, side-effects isolated, absolute `@/` imports, tests co-located. Pure helpers (sort comparator, category grouping, totals, "X/3" readiness, cents/dollars) are unit-tested directly. RLS verified manually against e2e (not Jest-testable).

---

## Fast follows (not in v1)

- Reserve-study helper text **hyperlinks** to the Capital Reserve Analysis PDF in `/documents` (once uploaded/referenceable).
- **Deeper treasury integration** — surface CRA estimates/actuals to the treasurer (clean now that money is integer cents on both sides).
- `cra_quotes.updated_at` + trigger if "last edited" display is ever wanted.

## Resolved open questions

- *Members commenting on projects?* — No; updates log is `canEditCRA`-only, members read-only.
- *Quotes need an "accepted" flag?* — Yes: `is_selected boolean`, one winner enforced in the action.
- *Storage upload vs Drive URL?* — Both, via `FileUploadButton` + `documents` bucket and `url_type`.
- *Money representation?* — Integer cents (match treasury; clean future join).
