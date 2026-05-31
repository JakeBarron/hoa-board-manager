# Meeting Start by Scheduled ID

**Status:** Idea — not started
**Priority:** Low (revisit after PR #4 is merged)

## Idea

Right now, "Start Meeting" finds or creates a meeting for today's date regardless of which scheduled meeting you're acting on. The meeting runner's minutes, motions, and timestamps are anchored to the actual start time, which is correct for auditing — but the connection back to the *scheduled* meeting row is implicit (same date) rather than explicit (same ID).

The user wants to tie meeting starts to their scheduled meeting IDs and expose Start Meeting as a per-row action.

## Proposed behavior (to be fleshed out)

- Each pending meeting row in the Upcoming list would have a "Start Meeting" button.
- Clicking it starts (or resumes) **that specific meeting** by ID, not "today's meeting."
- If there are no upcoming scheduled meetings, a "Start Meeting" button appears conditionally (current behavior — create one on the fly for today).
- The meeting runner at `/meetings/[id]` already works off a meeting ID, so the modal wiring is mostly there.

## Open questions

- What happens if you try to start a scheduled meeting while a different meeting is already `in_progress`? Block it? Prompt to resume the open one first?
- Does starting a future-dated scheduled meeting (e.g., tomorrow's) update its `meeting_date` to today, or keep the scheduled date and record `started_at` separately?
- Should the on-the-fly "no meetings scheduled" path create a new row or surface a scheduling step first?

## Notes

- `startOrResumeMeeting` currently ignores the scheduled meeting's ID — it would need a new action path that accepts a `meetingId` and promotes it to `in_progress`.
- The existing `callToOrder` action already takes a `meetingId`, so the runner itself is already ID-aware.
- The current `meetings` schema has `started_at` and `meeting_date` as separate columns, which supports keeping the original scheduled date while recording when it actually started.
