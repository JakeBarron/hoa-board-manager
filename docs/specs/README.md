# Feature Specs

Design decisions and open questions. Update the status when work begins or completes.

## Outstanding (not yet built)

| Spec | Status | Priority |
|---|---|---|
| [Feature Backlog (VP intake)](./feature-backlog.md) | Captured, none greenlit — 14 briefs from the VP's idea list (RSVP/quorum, vendor DB, chair history, clubhouse rental, delinquency follow-up, property counts, budget viz, social playbooks, **office knowledge base**, templates, access vault, bylaw list, lake). Promote a brief to its own spec when scheduled. | Intake |
| Amenities (Pool / Clubhouse / Tennis) | Not started — `/amenities` is an EmptyState; no spec written. | Low |
| Motions / voting UI | Schema-ready, no dedicated UI — `motions` + `motion_votes` exist and the meeting runner uses them, but there is no standalone motion-proposal or per-member voting interface (secretary records everything). | Low |

## Built (specs kept for history)

| Spec | Where it shipped |
|---|---|
| [CRA Projects](./cra-projects.md) | `/cra` (card list, Open/Complete tabs, FY filter, totals), `/cra/new`, `/cra/[id]` (inline edit, quotes add/select/delete, immutable updates log, documents); integer-cents money (`lib/money.ts`); `actions/cra.ts`; `is_cra_editor()` RLS + `canEditCRA(role, name)` for the CRA chair; migration `0022`; plan at `docs/superpowers/plans/2026-06-17-cra-projects.md` |
| [Agenda → Meetings Integration](./agenda-meeting-integration.md) | Agenda is now the start-time minutes scaffold; meetings are a sequential queue with one NEXT meeting; pre-meeting updates keyed to `meeting_id`; prep view on `/meetings/[id]` replaces `/agenda`; migration `0020` |
| [Operating Calendar](./operating-calendar.md) | `/calendar` (Annual Cycle) — month-grouped read view + filter, president/officer admin CRUD, dashboard widget; migration `0019`; plan at `docs/superpowers/plans/2026-06-15-operating-calendar.md` |
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
