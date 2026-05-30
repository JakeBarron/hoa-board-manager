# HOA Board Manager

An internal management portal for a homeowners association board. Built and maintained by the board president. Also a portfolio project demonstrating a full-stack Next.js application with real-world requirements.

## What it does

- **Home dashboard** — board-wide summary of pending architecture requests and active capital projects
- **My Office** — each board member and committee chair has a personal workspace with their todos, pre-meeting update form, and (for board members) meeting minutes
- **Meetings** — schedule meetings, run them live with motion recording and voting, export minutes to `.docx`, store Drive links
- **Architecture requests** — homeowners submit requests; president records board votes inline
- **Agenda** — auto-generated meeting agenda from submitted pre-meeting updates, with mailto: reminder links for missing submissions
- **CRA Projects** — capital reserve project tracker (in progress)
- **Amenities / Interactive Map** — coming soon

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (`@base-ui/react`) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel |
| Testing | Jest + React Testing Library (128 tests) |

## Auth model

Position-based accounts — 13 fixed logins (8 board positions + 5 committee chairs). No public registration. RLS policies enforce role-based access at the database layer, with per-page redirect guards in the app.

| Role | Positions |
|---|---|
| `president` | President |
| `officer` | VP, Secretary |
| `member` | Treasurer, Pool, Membership, Tennis, Social |
| `chair` | Web, Architecture, Welcoming, Clubhouse, CRA committees |

## Development

```bash
pnpm install
pnpm dev        # start dev server at localhost:3000
pnpm test       # run Jest
pnpm type-check # tsc --noEmit
```

Requires `.env.local` with Supabase credentials (see `CLAUDE.md` for the full environment variable reference).

## Architecture notes

- `app/(dashboard)/layout.tsx` — authenticates every dashboard route, resolves position, renders sidebar
- `lib/permissions.ts` — pure ACL functions; same logic mirrored in Supabase RLS policies
- `components/hoa/` — all domain-specific components, self-contained and independently testable
- `supabase/migrations/` — versioned SQL migrations, applied manually in the Supabase SQL editor
