@AGENTS.md

# HOA Board Management — Project Guide

Internal board management portal for an HOA. Also a portfolio project for Jake (president of the HOA, applying for software engineering roles). Public GitHub repo.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript — **read `node_modules/next/dist/docs/` before writing any Next.js code** |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (backed by `@base-ui/react`) |
| Backend | Supabase — Postgres DB + Auth + Storage |
| Hosting | Vercel |
| Package manager | pnpm |
| Testing | Jest + React Testing Library (39 tests, all passing) |
| Forms | react-hook-form + zod |

---

## Critical Next.js 16 Gotchas

- Middleware is now **`proxy.ts`** (not `middleware.ts`). Export `proxy` not `middleware`.
- `params` in page components is a **Promise** — must be `await`ed: `const { id } = await params`.
- Tailwind v4 uses **CSS `@theme`** in `globals.css` — no `tailwind.config.ts` for theme tokens.

## Critical shadcn/ui v4 Gotcha

shadcn/ui v4 uses `@base-ui/react`. **`asChild` does not exist.** To render a Button as a Link:
```tsx
// ✅ correct
<Button render={<Link href="/path" />}>Label</Button>

// ❌ wrong — will not compile
<Button asChild><Link href="/path">Label</Link></Button>
```

---

## Coding Standards (non-negotiable)

- **JSDoc on every exported function** — what it does, params, return value, non-obvious behavior
- **Functions do one thing** — split before adding complexity
- **Pure functions preferred** — same input → same output, no hidden state
- **Side effects isolated** — DB writes never mixed with transformation logic
- **Currying** for reusable function factories
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
  (auth)/login/          — login page + LoginForm client component
  (dashboard)/           — all authenticated pages share DashboardLayout
    layout.tsx           — fetches position from DB, renders Sidebar, guards auth
    dashboard/           — summary of pending requests + active CRA projects
    architecture/        — architecture approval requests (stub)
    cra/                 — Capital Reserves Analysis projects (stub)
    board/[position]/    — per-position dashboard, minutes, todos
    pre-meeting/         — pre-meeting status update form (stub)
    agenda/              — generated meeting agenda (stub)
    admin/positions/     — president-only position management

actions/
  auth.ts                — signIn / signOut server actions

components/
  ui/                    — shadcn/ui primitives (owned source, editable)
  hoa/                   — HOA-specific wrappers
    PageHeader           — page title + subtitle + optional right action
    SectionCard          — card with header/body + optional header action
    StatusBadge          — color-coded pill for AppStatus values
    FormField            — label + input + error message wrapper
    EmptyState           — "nothing here yet" placeholder
    Sidebar              — authenticated nav sidebar

lib/
  permissions.ts         — pure ACL functions (canEditAll, canEditSection, isAdmin, canEditCRA, canRecordVote)
  supabase/
    client.ts            — browser Supabase client (Client Components)
    server.ts            — server Supabase client (Server Components / Actions)
    middleware.ts        — session refresh for proxy.ts

types/
  database.ts            — full DB schema as TypeScript types (stub — regenerate with Supabase CLI)
  domain.ts              — app-level types (BoardSession, ArchitectureRequestWithDocs, etc.)

supabase/
  migrations/            — SQL migrations (run in Supabase SQL editor in order)
    0001_initial_schema  — full schema, RLS policies, grants
    0002_add_secretary   — adds secretary position
    0003_add_officer_role — adds officer role, tightens RLS write policies
  seed.ts                — creates 8 position accounts (run: pnpm seed)
```

---

## Auth & Permissions

**Position-based accounts** — 8 fixed accounts, one per board position. No self-registration.

| Role | Who | What they can do |
|---|---|---|
| `president` | President | Full access + admin (manage/reassign positions) |
| `officer` | VP, Secretary | Read all + edit any section |
| `member` | Treasurer, Pool, Membership, Tennis, Social | Read all + edit own section only |

Permission checks live in `lib/permissions.ts`. All RLS policies enforce the same rules at the DB layer.

**Route protection:** `proxy.ts` calls `lib/supabase/middleware.ts` → `updateSession()` which calls `getUser()` (verified, not just cookie) and redirects to `/login` for unauthenticated requests. `/architecture/[id]` is intentionally public (deep-link sharing).

---

## Database

All tables in Supabase public schema with RLS enabled. Key tables:

- `positions` — 8 rows, maps position name → email → role
- `architecture_requests` + `architecture_documents` — homeowner requests, public read
- `cra_projects` + `cra_quotes` + `cra_updates` + `cra_documents` — capital projects
- `meeting_minutes`, `todos`, `pre_meeting_updates` — per-position board content

**Supabase client setup:**
- Use `lib/supabase/server.ts` in Server Components and Server Actions
- Use `lib/supabase/client.ts` in Client Components
- The Supabase client is typed with `Database` from `types/database.ts`

**Important:** Tables were created via raw SQL (not Supabase UI) so explicit grants are required. Migration 0001 includes `grant all on all tables in schema public to anon, authenticated, service_role`.

**Seed:** `pnpm seed` — idempotent, safe to re-run. Checks auth user and position row independently.

---

## What's Built vs. What's Stubbed

### Built (functional)
- Login / logout flow with Supabase Auth
- Route protection via `proxy.ts`
- Dashboard layout with position-aware sidebar (shows admin link to president only)
- Dashboard summary page (reads pending arch requests + active CRA projects)
- HOA component library with full tests (PageHeader, SectionCard, StatusBadge, FormField, EmptyState)
- ACL permission model with unit tests
- Full DB schema + RLS + migrations
- Seed script for all 8 positions

### Stubbed (page exists, no real functionality yet)
- `/architecture` — list of requests (EmptyState)
- `/architecture/new` — upload form placeholder
- `/architecture/[id]` — public deep-link view placeholder
- `/cra` — project list (EmptyState)
- `/cra/new` — project creation form placeholder
- `/cra/[id]` — project detail placeholder
- `/board/[position]` — position dashboard with empty minutes + todos cards
- `/board/[position]/minutes` — minutes list (EmptyState)
- `/board/[position]/todos` — todo list (EmptyState)
- `/pre-meeting` — status update form placeholder
- `/agenda` — agenda view (EmptyState)
- `/admin/positions` — lists positions + emails, no edit form yet

---

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm test         # run Jest (39 tests)
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
