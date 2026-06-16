# Feature Specs

Design decisions and open questions. Update the status when work begins or completes.

## Outstanding (not yet built)

| Spec | Status | Priority |
|---|---|---|
| [CRA Projects](./cra-projects.md) | Not started — schema ready (`cra_projects`, `cra_quotes`, `cra_updates`, `cra_documents`); dashboard reads active projects, but `/cra` is an EmptyState, `/cra/new` is a placeholder, and there is no `/cra/[id]`. | High |
| Operating Calendar | Feature request (no spec file yet) — key annual dates + deliverables with templates; requested by treasurer. Nothing built. | Medium |
| [Agenda → Meetings Integration](./agenda-meeting-integration.md) | Designed, ready to build (2026-06-16) — agenda becomes the scaffold that seeds the minutes editor at start; meetings become a sequential queue with one NEXT meeting everyone targets; pre-meeting updates re-keyed to `meeting_id`; `/agenda` + `/pre-meeting` fold into a prep view on `/meetings/[id]`. | Medium |
| Amenities (Pool / Clubhouse / Tennis) | Not started — `/amenities` is an EmptyState; no spec written. | Low |
| Motions / voting UI | Schema-ready, no dedicated UI — `motions` + `motion_votes` exist and the meeting runner uses them, but there is no standalone motion-proposal or per-member voting interface (secretary records everything). | Low |

## Built (specs kept for history)

| Spec | Where it shipped |
|---|---|
| [Meeting Runner](./meeting-runner.md) | `/meetings/[id]` — non-realtime, secretary-controlled |
| [Architecture Upload](./architecture-upload.md) | `/architecture/new` — multi-file PDF upload to Storage; PDF preview on `/architecture/[id]` |
| [Admin Positions Edit](./admin-positions-edit.md) | `/admin/positions` — inline edit via `PositionEditRow`; email change updates auth user + sends reset |
| [Non-Voting Chairs](./non-voting-chairs.md) | Committee-chair accounts, `/committee/[chair]`, chair-aware Sidebar + redirect guards |
| [Production Environment](./production-environment.md) | Live at `board.eastspringlake.com` (prod Supabase); `main` deploys to prod, branch PRs to e2e |
| Treasury Dashboard | `/treasury`, `/treasury/actuals`, `/treasury/budget` — plan at `docs/superpowers/plans/2026-06-12-treasury-dashboard.md` |
| Interactive Map | `/map` — `MapView` + `NeighborhoodMap`; plan at `docs/superpowers/plans/2026-05-31-interactive-map.md` |
| Password Reset | `/confirm-reset` + `/update-password`; `actions/auth.ts` |
| Meeting Cancel / Reschedule | `cancelMeeting` / `rescheduleMeeting` in `actions/meetings.ts`; UI on `/meetings` |
| Meetings Schedule Modal | `ScheduleMeetingModal` on `/meetings` |
