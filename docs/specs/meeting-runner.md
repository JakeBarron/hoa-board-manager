# Meeting Runner

Live in-meeting tool: call to order, motions, voting, minutes, adjournment.

## Status
Complete. UI built at `/meetings/[id]`. Went with a non-realtime approach — secretary controls the entire flow (motions, votes, minutes) rather than each member interacting independently. Supabase Realtime was not used.

---

## Meeting Flow

1. Any voting member calls the meeting to order (proposes the motion)
2. A second member seconds — meeting is now `in_progress`
3. Timer starts (displayed on screen, stored as `started_at`)
4. Secretary types live minutes in the WYSIWYG editor (Tiptap, same as `MinutesForm`)
5. President calls motions during the meeting (each requires a second)
6. Each voting member casts their vote; president can override absent members
7. President adjourns — meeting status becomes `adjourned`, all votes lock
8. Secretary exports minutes to `.docx`, uploads to Google Drive, pastes link

## Seconding requirement
Applies to **all** motions including call-to-order. Every motion stores:
- `proposed_by` (position UUID)
- `seconded_by` (position UUID)
- Timestamps for proposal and seconding

## Voting

Each `motion_vote` record:
| Field | Notes |
|---|---|
| `position_id` | Who the vote belongs to |
| `vote` | `yay \| nay \| absent \| no_vote` |
| `recorded_by` | Self when voting own seat; president's ID when overriding |
| `voted_at` | Timestamp |

Rules:
- A member can only cast their own vote (RLS enforces this)
- President can override any vote to `absent` or `no_vote` — always attributed via `recorded_by`
- Votes are **immutable** once the meeting is adjourned — no update/delete policies exist on `motion_votes`
- Corrections require a new amendment motion referencing the original

## Quorum
- Threshold from `settings` table (`quorum_required`, default 5)
- `quorum_met` boolean stored on each `motions` row at close time
- Meeting can proceed with quorum even if some members are absent

## Real-time
Use **Supabase Realtime** (Postgres logical replication). All participants subscribe to changes on `meetings`, `motions`, and `motion_votes` for the active meeting ID. No separate WebSocket infrastructure needed.

## Minutes
- Secretary types live in a Tiptap WYSIWYG editor during the meeting
- Stored in `meetings.minutes_content` (HTML)
- At adjournment: export to `.docx` via `/api/minutes/[meetingId]/export` (same pattern as board minutes)
- User uploads to Google Drive, pastes link → stored in `meetings.minutes_drive_url`
- Amendments: separate Drive files named `<filename>_amendment_<n>`; app stores links in `meeting_documents`

## UI pages needed

| Route | Description |
|---|---|
| `/meetings` | List upcoming + past meetings (partially built) |
| `/meetings/new` | Schedule a meeting — date picker, officer+ only (MeetingScheduleForm exists) |
| `/meetings/[id]` | Live meeting runner — timer, motion list, vote interface |
| `/meetings/[id]/minutes` | Post-meeting: paste Drive link, view recorded votes |

## Open questions
- Should the meeting runner be a full-screen mode or stay within the normal layout?
- Do we want a "call a motion" button available to any voting member, or president-only?
- How do we handle a member who joins late (after quorum was established)?
