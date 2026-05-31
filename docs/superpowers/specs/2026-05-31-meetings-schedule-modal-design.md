# Meetings Schedule Modal — Design Spec

**Date:** 2026-05-31
**Branch:** to be implemented on a fresh branch from `feat/meeting-cancel-reschedule`
**Status:** Approved

---

## Problem

Scheduling a new meeting requires navigating to a separate `/meetings/new` page, which is unnecessary friction. Past pending meetings have no way to be cancelled or rescheduled. And there is no protection against scheduling meetings in the past.

---

## Scope

1. Replace the "Schedule meeting" link with a modal dialog, pre-filled to the next unfilled cadence date.
2. Harden `createMeeting` with date and conflict validation.
3. Allow past pending meetings to be cancelled and rescheduled.
4. Reorder PageHeader buttons: "Schedule meeting" before "Start Meeting".
5. Delete the now-unused `/meetings/new` page and `MeetingScheduleForm` component (redirect the route to `/meetings`).

---

## Server Action — `createMeeting` (harden existing)

Add two validations before the DB insert:

1. **Past date guard** — throw `"Date must be in the future"` if `meetingDate < today` (using `America/New_York` timezone, matching `rescheduleMeeting`).
2. **Conflict guard** — query for an existing `pending` or `in_progress` meeting on `meetingDate`; throw `"A meeting is already scheduled for that date"` if one exists.

Existing JSDoc and `revalidatePath` calls stay as-is.

---

## Data — `MeetingsPage` (server component)

Add `meeting_cadence` to the existing settings query:

```ts
supabase.from("settings").select("key, value").in("key", ["hoa_name", "drive_folder_url", "meeting_cadence"])
```

After fetching, compute `defaultScheduleDate`:

1. Parse cadence via `parseCadence(cadenceValue)`.
2. Generate next 6 cadence dates via `getUpcomingMeetingDates(cadence, 6)`.
3. Filter out any dates already present in the `upcoming` list.
4. Take the first remaining date.
5. Fall back to today's ISO date if cadence is unset or all 6 are booked.

Pass `defaultScheduleDate: string` to `MeetingListClient`.

---

## New Component — `ScheduleMeetingModal`

**File:** `components/hoa/ScheduleMeetingModal.tsx`

**Props:**
```ts
interface ScheduleMeetingModalProps {
  positionId: string;
  defaultDate: string;       // ISO YYYY-MM-DD — pre-filled from cadence
  onClose: () => void;
}
```

**Behaviour:**
- Renders a modal overlay (simple fixed backdrop + centered card — no shadcn Dialog dependency needed, matching the style of `MeetingRunnerModal`'s overlay pattern).
- Contains a date `<input type="date">` pre-filled with `defaultDate`, `minDate = today`.
- "Schedule" (primary) and "Cancel" (ghost) buttons.
- On submit: calls `createMeeting(positionId, date)` inside `useTransition`. On success, calls `onClose()` and the server revalidation refreshes the list. On error, displays the error message inline (`role="alert"`).
- Save button disabled while `isPending` or date is empty / before today.

**Exported from** `components/hoa/index.ts`.

---

## `MeetingListClient` Changes

1. Add prop: `defaultScheduleDate: string`.
2. Add state: `const [showScheduleModal, setShowScheduleModal] = useState(false)`.
3. Replace the `<Button render={<Link href="/meetings/new" />}>Schedule meeting</Button>` with:
   ```tsx
   <Button size="sm" variant="outline" onClick={() => setShowScheduleModal(true)}>
     Schedule meeting
   </Button>
   ```
4. **Reorder buttons**: "Schedule meeting" renders before "Start Meeting" in the `canSchedule` block.
5. Render `ScheduleMeetingModal` when `showScheduleModal` is true:
   ```tsx
   {showScheduleModal && (
     <ScheduleMeetingModal
       positionId={currentPositionId}
       defaultDate={defaultScheduleDate}
       onClose={() => setShowScheduleModal(false)}
     />
   )}
   ```
6. Change past rows from `canSchedule={false}` → `canSchedule={canSchedule}`. `MeetingRow` already gates on `status === "pending"`, so adjourned past rows are unaffected.

---

## Route Cleanup

- `app/(dashboard)/meetings/new/page.tsx` — replace with a server component that immediately `redirect("/meetings")`.
- `components/hoa/MeetingScheduleForm.tsx` — delete (no longer referenced anywhere).
- `components/hoa/MeetingScheduleForm.test.tsx` — delete if it exists.

---

## Tests

### `actions/meetings.test.ts` (additions to existing `createMeeting` describe)
- Throws `"Date must be in the future"` when `meetingDate` is yesterday.
- Throws `"A meeting is already scheduled for that date"` when a conflict exists.
- Resolves and revalidates on a valid future date with no conflict.

### `components/hoa/ScheduleMeetingModal.test.tsx`
- Renders the date input pre-filled with `defaultDate`.
- "Schedule" button disabled when date is empty.
- Calls `createMeeting` with `positionId` and selected date on submit.
- Calls `onClose` after successful submit.
- Shows error alert when `createMeeting` throws.
- Calls `onClose` when "Cancel" is clicked.

### `app/(dashboard)/meetings/page.test.tsx` — not needed (server component; logic is pure date math already covered by `lib/dates.test.ts`).

---

## Deferred

No deferred items — this is a self-contained scope.
