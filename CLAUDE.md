@AGENTS.md

# HOA Board Management — Project Guide

Internal board management portal for an HOA. Also a portfolio project for Jake (president of the HOA, applying for software engineering roles). Public GitHub repo.

**Working directory:** `/Users/jake/dev/hoa-board-manager`
**GitHub:** `https://github.com/JakeBarron/hoa-board-manager`

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript — **read `node_modules/next/dist/docs/` before writing any Next.js code** |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (backed by `@base-ui/react`) |
| Backend | Supabase — Postgres DB + Auth + Storage |
| Hosting | Vercel |
| Package manager | pnpm |
| Testing | Jest + React Testing Library (180 tests, all passing) |
| Forms | react-hook-form + zod |

---

## Critical Next.js 16 Gotchas

- Middleware is now **`proxy.ts`** (not `middleware.ts`). Export `proxy` not `middleware`.
- `params` **and** `searchParams` in page components are both **Promises** — always `await` them:
  ```ts
  const { id } = await params;
  const { date } = await searchParams;
  ```
- Tailwind v4 uses **CSS `@theme`** in `globals.css` — no `tailwind.config.ts` for theme tokens.

## Critical shadcn/ui v4 Gotcha

shadcn/ui v4 uses `@base-ui/react`. **`asChild` does not exist.** To render a Button as a Link:
```tsx
// ✅ correct — nativeButton={false} required because Link renders <a>, not <button>
<Button nativeButton={false} render={<Link href="/path" />}>Label</Button>

// ❌ wrong — will not compile
<Button asChild><Link href="/path">Label</Link></Button>

// ❌ wrong — triggers Base UI warning (Button expects <button>, Link renders <a>)
<Button render={<Link href="/path" />}>Label</Button>
```

## Critical Supabase TypeScript Gotchas

**Every table type must have `Relationships: []`** or the Supabase client's `from()` generic collapses to `never` and `.insert()` / `.update()` break with misleading type errors:
```ts
// ✅ in types/database.ts — every table needs this
todos: {
  Row: { ... };
  Insert: { ... };
  Update: { ... };
  Relationships: [];   // ← required even if empty
};
```

**Never destructure `{ data }` inline from `Promise.all`** — TypeScript loses table-specific type inference:
```ts
// ✅ correct
const [r1, r2] = await Promise.all([query1, query2]);
const thing1 = r1.data;

// ❌ breaks inference — everything becomes `never`
const [{ data: thing1 }, { data: thing2 }] = await Promise.all([...]);
```

**Cast URL params when using in `.eq()` calls** — Next.js gives `string`, Supabase expects the column's enum type:
```ts
.eq("name", position as PositionName)
```

---

## Coding Standards (non-negotiable)

- **JSDoc on every exported function** — what it does, params, return value, non-obvious behavior
- **Functions do one thing** — split before adding complexity
- **Pure functions preferred** — same input → same output, no hidden state
- **Side effects isolated** — DB writes never mixed with transformation logic
- **`map`/`filter`/`reduce`** for data transforms — never mutate in place
- **No `any`** — use `unknown` + type guards at system boundaries
- **No `asChild`** — see shadcn gotcha above
- **No default exports** except Next.js page/layout files
- **Absolute imports** via `@/` — never `../../../`
- **Tests co-located** with source files (`foo.ts` → `foo.test.ts`)
- **Test behavior, not implementation** — no snapshot tests
- **Simplicity gate**: if something isn't simple, stop and rethink before implementing

---

## Project Structure

```
app/
  (auth)/login/              — login page + LoginForm client component
  (dashboard)/               — all authenticated pages share DashboardLayout
    layout.tsx               — fetches position from DB, renders Sidebar, guards auth
    dashboard/               — Home: board-wide summary (arch requests + active CRA)
    meetings/                — board meeting list (upcoming + past, status badges)
    meetings/new/            — schedule a meeting — officer+ only
    architecture/            — architecture requests list with status badges + president vote form
    board/[position]/        — My Office for board members: todos, minutes preview, pre-meeting form
    board/[position]/minutes/     — minutes list with Drive links + export
    board/[position]/minutes/new/ — WYSIWYG editor → docx export → Drive URL
    board/[position]/todos/       — full todo list (add / toggle / delete)
    committee/[chair]/       — My Office for committee chairs: pre-meeting form + role-specific content
    pre-meeting/             — officer/president aggregate view of all updates (members + chairs redirect to own page)
    agenda/                  — auto-generated HOA agenda from pre-meeting updates + mailto: reminders
    amenities/               — Pool, Clubhouse, Tennis (STUB — placeholder)
    map/                     — Interactive neighborhood map (STUB — placeholder)
    admin/positions/         — president-only: lists positions + emails (edit form not yet built)
    admin/settings/          — president-only: configurable settings (quorum, HOA name, meeting cadence)
  architecture/[id]/         — PUBLIC detail page (outside dashboard — no auth required)
  api/minutes/[id]/export/   — GET route: converts minutes HTML → .docx download

actions/
  auth.ts          — signIn / signOut / requestPasswordReset / confirmPasswordReset / updatePassword
  architecture.ts  — recordVote (president only)
  meetings.ts      — createMeeting
  minutes.ts       — saveMinutes, updateMinutesDriveUrl
  pre-meeting.ts   — submitPreMeetingUpdate (upsert on position_id + meeting_date)
  settings.ts      — updateSetting (president only)
  todos.ts         — addTodo, toggleTodo, deleteTodo

components/
  ui/                    — shadcn/ui primitives (owned source, editable)
  hoa/                   — HOA-specific components (all exported from hoa/index.ts)
    PageHeader           — page title + subtitle + optional right action
    SectionCard          — card with header/body + optional header action
    StatusBadge          — color-coded pill for AppStatus values
    FormField            — label + input + error message wrapper (requires htmlFor)
    EmptyState           — "nothing here yet" placeholder
    Sidebar              — authenticated nav sidebar; function-first nav, chair-aware (admin section president-only)
    TodoList             — interactive add/toggle/delete with permission gate (client)
    RichTextEditor       — Tiptap StarterKit WYSIWYG (bold, italic, H2/H3, lists, blockquote)
    MinutesForm          — write minutes → save → export docx → paste Drive URL (client)
    PreMeetingForm       — date quick-select + textarea, upserts on submit; accepts returnPath prop for date-change navigation (client)
    VoteForm             — inline collapsed/expanded vote form for president (client)
    MeetingScheduleForm  — date picker to schedule a meeting (client)
    SettingRow           — generic editable setting row with inline save feedback (client)
    MeetingCadenceRow    — week-of-month + day-of-week dropdowns for meeting cadence (client)

lib/
  permissions.ts   — pure ACL: canEditAll, canEditSection, isAdmin, canEditCRA, canRecordVote, isChair
  dates.ts         — getUpcomingMondays, getUpcomingMeetingDates, parseCadence,
                     describeCadence, formatMeetingDate
  reminder.ts      — buildReminderMailto (pure; pre-filled mailto: URL for missing submissions)
  supabase/
    client.ts      — browser Supabase client (Client Components)
    server.ts      — server Supabase client (Server Components / Actions)
    middleware.ts  — updateSession() called by proxy.ts

types/
  database.ts      — hand-maintained DB schema types (all tables have Relationships: [])
  domain.ts        — app-level types (BoardSession, ArchitectureRequestWithDocs, etc.)
  html-to-docx.d.ts — local declaration for untyped package

docs/
  specs/           — unimplemented feature specs (see docs/specs/README.md)

supabase/
  migrations/      — run in Supabase SQL editor in order (no CLI integration)
    0001_initial_schema   — full schema, RLS, grants
    0002_add_secretary    — adds secretary position
    0003_add_officer_role — officer role, tightened RLS writes
    0004_settings         — settings table (quorum_required, hoa_name, meeting_cadence)
    0005_meeting_schema   — meetings, motions, motion_votes, meeting_documents
    0006_update_settings  — removes board_size, adds meeting_cadence
    0009_committee_chairs — extends role/name constraints, adds reminder_sent_at to meetings, inserts 5 chair rows
    0010_reminder_rls     — UPDATE policy so officers can write reminder_sent_at
  seed.ts          — creates 13 position accounts (8 board + 5 committee chairs) (run: pnpm seed)
```

---

## Auth & Permissions

**Position-based accounts** — 13 fixed accounts (8 board + 5 committee chairs). No self-registration.

| Role | Who | What they can do |
|---|---|---|
| `president` | President | Full access + admin (manage positions, change settings, record votes) |
| `officer` | VP, Secretary | Read all + edit any section |
| `member` | Treasurer, Pool, Membership, Tennis, Social | Read all + edit own section only |
| `chair` | Web, Architecture, Welcoming, Clubhouse, CRA | Access `/dashboard` and `/committee/[their-name]` only |

**Chair routing:** Every restricted dashboard page has a per-page guard — `if (isChair(role)) redirect('/committee/${name}')`. The Sidebar also renders a minimal nav (Home + My Office) for chairs. ⚠️ Permission audit pending — some pages may be missing the chair redirect guard (known: `/cra/new` accessible to chairs via direct URL).

Permission checks live in `lib/permissions.ts`. RLS policies enforce the same rules at the DB layer.

**Route protection:** `proxy.ts` → `lib/supabase/middleware.ts` → `updateSession()` calls `getUser()` (verified server-side, not just cookie) and redirects to `/login` if unauthenticated. `/architecture/[id]` is intentionally public (homeowner deep-link sharing). `/login`, `/auth/callback`, `/update-password`, and `/confirm-reset` are also public.

**Password reset flow:** `requestPasswordReset` → Supabase sends email with link to `/confirm-reset?token_hash=...&type=recovery` (custom email template required — see `docs/services.md`). The confirmation page renders without consuming the token; the user must click "Confirm" to call `confirmPasswordReset` (server action → `verifyOtp` → redirect to `/update-password`). The intermediate page protects against email scanner pre-consumption of the one-time token. Transactional email delivered via Resend (SMTP configured in Supabase Auth settings).

---

## Database

All tables in Supabase public schema with RLS enabled.

| Table(s) | Purpose |
|---|---|
| `positions` | 13 rows (8 board + 5 chairs) — position name → email → role |
| `architecture_requests`, `architecture_documents` | Homeowner requests; public read via anon RLS |
| `cra_projects`, `cra_quotes`, `cra_updates`, `cra_documents` | Capital projects tracker |
| `meeting_minutes`, `todos`, `pre_meeting_updates` | Per-position board content |
| `meetings` | Scheduled meetings (pending → in_progress → adjourned) |
| `motions`, `motion_votes` | Formal motions + per-member votes; schema ready, no UI yet |
| `meeting_documents` | Drive links for approved minutes + amendments |
| `settings` | Configurable key/value pairs (quorum_required, hoa_name, meeting_cadence) |

**Supabase clients:**
- `lib/supabase/server.ts` — Server Components and Server Actions
- `lib/supabase/client.ts` — Client Components
- Both typed with `Database` from `types/database.ts`

**meeting_cadence format:** stored as `"week:dayOfWeek"` (e.g. `"3:2"` = 3rd Tuesday).
Parse with `parseCadence()` and generate dates with `getUpcomingMeetingDates()` from `lib/dates.ts`.

**Seed:** `pnpm seed` — idempotent, safe to re-run.

---

## What's Built vs. What's Stubbed

### Fully functional
- Login / logout (Supabase Auth) + route protection
- `/dashboard` (Home) — board-wide summary: pending arch requests + active CRA projects
- `/meetings` — list with status badges; officer+ can schedule via `/meetings/new`
- `/architecture` — full requests list with StatusBadge; president sees inline VoteForm on pending items
- `/architecture/[id]` — public detail page (outside dashboard group, no auth)
- `/board/[position]` — My Office for board members: todos preview + pre-meeting form + minutes card
- `/board/[position]/todos` — full CRUD, permission-gated
- `/board/[position]/minutes` — list with Drive links + per-row docx export
- `/board/[position]/minutes/new` — Tiptap WYSIWYG → docx → Drive URL flow
- `/committee/[chair]` — My Office for committee chairs: pre-meeting form; architecture chair also sees requests list
- `/pre-meeting` — officer/president aggregate view of all updates by date; members + chairs redirected to own page
- `/agenda` — HOA meeting agenda (call to order → approve minutes → board reports → committee reports → new business → adjourn); officer+ get mailto: reminder for missing submissions
- `/meetings/[id]` — meeting runner (non-realtime, secretary-controlled): motions, voting, live minutes via Tiptap, `.docx` export, Drive URL storage; amendment form for post-adjournment corrections
- `/admin/positions` — lists positions + emails (edit form not built — see `docs/specs/admin-positions-edit.md`)
- `/admin/settings` — configurable settings with inline save; meeting cadence uses dropdown UI

### Stubbed (page exists, placeholder only)
- `/amenities` — Pool, Clubhouse, Tennis (widgets not yet built)
- `/map` — Interactive neighborhood map (SVG + property data not yet built)
- `/cra` — EmptyState (see `docs/specs/cra-projects.md`)
- `/cra/new` — placeholder
- No `/cra/[id]` page yet

### Schema-ready, no UI
- Motions/voting UI — `motions` and `motion_votes` tables exist; the meeting runner uses them but there is no dedicated motion-proposal or per-member voting UI (secretary records everything)

---

## Key Patterns

### Server action shape
```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function myAction(arg: string): Promise<void> {
  const supabase = await createClient();
  // RLS enforces auth — still check role for clear error messages
  const { error } = await supabase.from("table").insert({ ... });
  if (error) throw new Error(error.message);
  revalidatePath("/relevant-path", "layout");
}
```

### Page data fetching
```ts
// Run independent queries in parallel; assign data separately
const [r1, r2] = await Promise.all([
  supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
  supabase.from("todos").select("*").eq("position_id", id),
]);
const position = r1.data;
const todos = r2.data;
```

### Meeting dates
Pages that show date pickers should:
1. Check `meetings` table for upcoming scheduled meetings
2. Fall back to `getUpcomingMeetingDates(cadence, 3)` using `meeting_cadence` from `settings`
3. Fall back to `getUpcomingMondays(3)` if cadence is invalid

---

## Commands

```bash
pnpm dev          # start dev server (run from /Users/jake/dev/hoa-board-manager)
pnpm build        # production build
pnpm test         # run Jest (180 tests)
pnpm type-check   # tsc --noEmit
pnpm seed         # seed 13 position accounts against .env.local (e2e project)
pnpm lint         # ESLint
```

To seed the **production** Supabase project:
```bash
npx tsx --env-file=.env.prod supabase/seed.ts
```

---

## Environment Variables

Three env files (none committed):

| File | Points to | Used for |
|---|---|---|
| `.env.local` | E2E Supabase project | Local dev + pnpm seed |
| `.env.prod` | Prod Supabase project | One-off prod scripts (e.g. seed) |

```bash
# both files have the same keys:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # legacy format (not sb_publishable_)
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # legacy format, server-side only
```

Use **legacy JWT keys** from Supabase Dashboard → Settings → API → "Legacy anon, service_role API keys" tab. The new `sb_publishable_` / `sb_secret_` format is not yet fully supported by `@supabase/supabase-js` v2.

**Vercel environment scoping:**
- `Production` env vars → prod Supabase project (live at `board.eastspringlake.com`)
- `Preview` + `Development` env vars → e2e Supabase project (has seed data)

Every branch PR auto-deploys against the e2e database. `main` deploys against prod.

---

## CI/CD & Branch Workflow

**main is locked** — never push directly. All changes go through a branch + PR.

Merge requirements:
- CI must pass (`pnpm type-check && pnpm test --ci`)
- 1 PR review required (CODEOWNERS: `@JakeBarron`)

Vercel deploys:
- `main` → production at `https://board.eastspringlake.com` (prod Supabase)
- Any branch PR → preview URL (e2e Supabase)

Supabase auth URL configuration (prod project → Authentication → URL Configuration):
- Site URL: `https://board.eastspringlake.com`
- Redirect URLs: `https://board.eastspringlake.com/*`
