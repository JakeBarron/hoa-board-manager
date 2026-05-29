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
| Testing | Jest + React Testing Library (82 tests, all passing) |
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
    dashboard/               — pending arch requests + active CRA projects summary
    meetings/                — board meeting list (upcoming + past, status badges)
    meetings/new/            — schedule a meeting — officer+ only
    architecture/            — architecture requests list with status badges + president vote form
    architecture/new/        — upload form (STUB — see docs/specs/architecture-upload.md)
    board/[position]/        — position dashboard: todos, minutes preview, pre-meeting form
    board/[position]/minutes/     — minutes list with Drive links + export
    board/[position]/minutes/new/ — WYSIWYG editor → docx export → Drive URL
    board/[position]/todos/       — full todo list (add / toggle / delete)
    pre-meeting/             — officer/president view of ALL submitted updates (members redirect to own position page)
    agenda/                  — auto-generated HOA agenda from pre-meeting updates + mailto: reminders
    admin/positions/         — president-only: lists positions + emails (edit form not yet built)
    admin/settings/          — president-only: configurable settings (quorum, HOA name, meeting cadence)
  architecture/[id]/         — PUBLIC detail page (outside dashboard — no auth required)
  api/minutes/[id]/export/   — GET route: converts minutes HTML → .docx download

actions/
  auth.ts          — signIn / signOut
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
    Sidebar              — authenticated nav sidebar (admin section president-only)
    TodoList             — interactive add/toggle/delete with permission gate (client)
    RichTextEditor       — Tiptap StarterKit WYSIWYG (bold, italic, H2/H3, lists, blockquote)
    MinutesForm          — write minutes → save → export docx → paste Drive URL (client)
    PreMeetingForm       — date quick-select + textarea, upserts on submit (client)
    VoteForm             — inline collapsed/expanded vote form for president (client)
    MeetingScheduleForm  — date picker to schedule a meeting (client)
    SettingRow           — generic editable setting row with inline save feedback (client)
    MeetingCadenceRow    — week-of-month + day-of-week dropdowns for meeting cadence (client)

lib/
  permissions.ts   — pure ACL: canEditAll, canEditSection, isAdmin, canEditCRA, canRecordVote
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
  seed.ts          — creates 8 position accounts (run: pnpm seed)
```

---

## Auth & Permissions

**Position-based accounts** — 8 fixed accounts, one per board position. No self-registration.

| Role | Who | What they can do |
|---|---|---|
| `president` | President | Full access + admin (manage positions, change settings, record votes) |
| `officer` | VP, Secretary | Read all + edit any section |
| `member` | Treasurer, Pool, Membership, Tennis, Social | Read all + edit own section only |

Permission checks live in `lib/permissions.ts`. RLS policies enforce the same rules at the DB layer.

**Route protection:** `proxy.ts` → `lib/supabase/middleware.ts` → `updateSession()` calls `getUser()` (verified server-side, not just cookie) and redirects to `/login` if unauthenticated. `/architecture/[id]` is intentionally public (homeowner deep-link sharing).

---

## Database

All tables in Supabase public schema with RLS enabled.

| Table(s) | Purpose |
|---|---|
| `positions` | 8 rows — position name → email → role |
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
- Dashboard summary (pending arch requests + active CRA)
- `/meetings` — list with status badges; officer+ can schedule via `/meetings/new`
- `/architecture` — list with StatusBadge, date, address; president sees inline VoteForm on pending items
- `/architecture/[id]` — public detail page (outside dashboard group, no auth)
- `/board/[position]` — todos preview + pre-meeting form (own page only) + minutes card
- `/board/[position]/todos` — full CRUD, permission-gated
- `/board/[position]/minutes` — list with Drive links + per-row docx export
- `/board/[position]/minutes/new` — Tiptap WYSIWYG → docx → Drive URL flow
- `/pre-meeting` — officer/president aggregate view of all updates by date; members redirected to `/board/[position]`
- `/agenda` — HOA meeting agenda (call to order → approve minutes → board reports → new business → adjourn); officer+ get mailto: reminder for missing submissions
- `/admin/positions` — lists positions + emails (edit form not built — see `docs/specs/admin-positions-edit.md`)
- `/admin/settings` — configurable settings with inline save; meeting cadence uses dropdown UI

### Stubbed (page exists, placeholder only)
- `/architecture/new` — file upload form (see `docs/specs/architecture-upload.md`)
- `/cra` — EmptyState (see `docs/specs/cra-projects.md`)
- `/cra/new` — placeholder
- No `/cra/[id]` page yet

### Schema-ready, no UI
- Meeting runner — `meetings`, `motions`, `motion_votes` tables all built; live meeting UI not started (see `docs/specs/meeting-runner.md`)

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
pnpm test         # run Jest (82 tests)
pnpm type-check   # tsc --noEmit
pnpm seed         # seed 8 position accounts (requires .env.local)
pnpm lint         # ESLint
```

---

## Environment Variables

```bash
# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # legacy format (not sb_publishable_)
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # legacy format, server-side only
```

Use **legacy JWT keys** from Supabase Dashboard → Settings → API → "Legacy anon, service_role API keys" tab. The new `sb_publishable_` / `sb_secret_` format is not yet fully supported by `@supabase/supabase-js` v2.

---

## CI/CD

- GitHub Actions: `pnpm type-check && pnpm test --ci` on every push and PR to `main`
- Branch protection: CI must pass + 1 review required before merge
- CODEOWNERS: `@JakeBarron` — add co-developer here when they join
- Vercel: auto-deploys `main`; preview deployments for PRs
- Future: `board.eastspringlake.com` subdomain (CNAME to Vercel) + separate prod Supabase project
