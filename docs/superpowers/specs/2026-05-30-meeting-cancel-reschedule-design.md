# Meeting Cancel & Reschedule — Design Spec

**Date:** 2026-05-30
**Branch:** feat/password-reset (to be implemented on a fresh branch)
**Status:** Approved

---

## Problem

There is no UI to cancel or reschedule a pending meeting. Creating a meeting by accident leaves a permanent ghost entry that skews the pre-meeting and agenda pages.

---

## Scope

- Cancel and reschedule apply to **pending** meetings only.
- In-progress meetings must be adjourned via the meeting runner before any delete path is available.
- Adjourned meetings are historical records — no mutation.

---

## Server Actions (`actions/meetings.ts`)

### `cancelMeeting` (exists — needs hardening)

Current implementation does an unconditional hard-delete. Two fixes required:

1. Add `.eq("status", "pending")` to the DELETE query so the action is a no-op on non-pending rows.
2. Check the affected row count after the delete; throw a clear error (`"Meeting is not in a cancellable state"`) if nothing was deleted.

### `rescheduleMeeting` (new)

```ts
export async function rescheduleMeeting(meetingId: string, newDate: string): Promise<void>
```

Steps:
1. Validate `newDate` is a parseable ISO date string and is not in the past. Throw `"Invalid date"` or `"Date must be in the future"` with a user-friendly message before touching the DB.
2. Query for any existing `pending` or `in_progress` meeting on `newDate`. Throw `"A meeting is already scheduled for that date"` if one exists.
3. Update `meeting_date` with `.eq("id", meetingId).eq("status", "pending")`. Check row count — throw `"Meeting is not in a reschedulable state"` if zero rows matched (race condition guard).
4. Revalidate `/meetings`, `/pre-meeting`, and `/agenda`.

---

## Database — New RLS Migration

A new migration is required to lock down the `meetings` DELETE path at the DB layer.

**Current state:** No DELETE policy exists on `meetings`; the table was created with `GRANT ALL TO authenticated`, meaning any authenticated user (including `member` role) can delete any meeting row directly.

**New policy:**

```sql
CREATE POLICY "officers and president can delete pending meetings"
ON meetings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM positions
    WHERE email = auth.email()
    AND role IN ('officer', 'president')
  )
  AND status = 'pending'
);
```

This mirrors the existing INSERT/UPDATE policies and makes the server-side `.eq("status", "pending")` guard a belt-and-suspenders check rather than the only line of defence.

---

## Component Architecture

```
MeetingsPage (server)
  └── MeetingListClient (client)         — modal state, passes canSchedule down
        └── MeetingRow (client)          — extracted to its own file; owns mode state
              ├── InlineConfirm (hoa)    — reusable destructive confirm strip
              └── InlineDateInput (hoa)  — reusable inline date edit form
```

### `MeetingRow` — `app/(dashboard)/meetings/MeetingRow.tsx`

New client component extracted from `MeetingListClient.tsx`.

**Props:**
```ts
interface MeetingRowProps {
  meeting: Pick<Meeting, "id" | "meeting_date" | "status">;
  canSchedule: boolean;
}
```

**State:**
```ts
type RowMode = "default" | "confirmCancel" | "reschedule";
const [mode, setMode] = useState<RowMode>("default");
const [error, setError] = useState<string | null>(null);
const [isPending, startTransition] = useTransition();
```

**Render logic:**
- Always renders date + `StatusBadge` as a link to `/meetings/[id]`.
- When `canSchedule && meeting.status === "pending"`:
  - `mode === "default"`: render subtle "Reschedule" and "Cancel" text buttons after the badge.
  - `mode === "confirmCancel"`: render `<InlineConfirm>` in place of the buttons.
  - `mode === "reschedule"`: render `<InlineDateInput>` below the row content.
- Inline error text below the row on action failure.

`MeetingListClient` passes `canSchedule` as a prop to each `MeetingRow` in its `upcoming.map(...)`.

### `InlineConfirm` — `components/hoa/InlineConfirm.tsx`

Reusable destructive-action confirmation strip.

**Props:**
```ts
interface InlineConfirmProps {
  message: string;
  confirmLabel?: string;   // default "Confirm"
  dismissLabel?: string;   // default "Dismiss"
  onConfirm: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}
```

Renders a single row: message text + Confirm button (destructive variant) + Dismiss button (ghost variant). Exported from `components/hoa/index.ts`.

### `InlineDateInput` — `components/hoa/InlineDateInput.tsx`

Reusable inline date editor.

**Props:**
```ts
interface InlineDateInputProps {
  defaultValue?: string;   // ISO date YYYY-MM-DD
  minDate?: string;        // ISO date — defaults to tomorrow
  onSave: (date: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}
```

Renders an `<input type="date">` with Save (primary) and Cancel (ghost) buttons. Client-side validation: date must be non-empty and >= `minDate` before calling `onSave`. Exported from `components/hoa/index.ts`.

---

## Data Flow — Reschedule

1. User clicks "Reschedule" → `mode` becomes `"reschedule"`.
2. `InlineDateInput` renders with `minDate = tomorrow`.
3. User picks a date and clicks Save.
4. `MeetingRow` calls `startTransition(() => rescheduleMeeting(id, date))` inside a try/catch.
5. On success: `mode` resets to `"default"`, page revalidates (server re-renders the row with the new date).
6. On error: `setError(err.message)` — displayed inline below the row; `mode` stays `"reschedule"`.

## Data Flow — Cancel

1. User clicks "Cancel" → `mode` becomes `"confirmCancel"`.
2. `InlineConfirm` renders with message `"Cancel the [date] meeting?"`.
3. User clicks Confirm.
4. `MeetingRow` calls `startTransition(() => cancelMeeting(id))` inside a try/catch.
5. On success: row disappears (server re-renders the list without the deleted row).
6. On error: `setError(err.message)` — displayed inline; `mode` resets to `"default"`.

---

## Tests

Co-located with source files per project convention.

### `actions/meetings.test.ts` (additions)

- `cancelMeeting`: throws when meeting is not pending (status guard).
- `rescheduleMeeting`: throws on invalid date string.
- `rescheduleMeeting`: throws when date is in the past.
- `rescheduleMeeting`: throws when another meeting exists on that date.
- `rescheduleMeeting`: throws when meeting is not pending (race condition guard).
- `rescheduleMeeting`: succeeds and revalidates paths for a valid future date on a pending meeting.

### `components/hoa/InlineConfirm.test.tsx`

- Renders message, Confirm, and Dismiss buttons.
- Calls `onConfirm` when Confirm is clicked.
- Calls `onDismiss` when Dismiss is clicked.
- Disables buttons when `isPending` is true.

### `components/hoa/InlineDateInput.test.tsx`

- Renders date input and Save/Cancel buttons.
- Calls `onSave` with the selected date value.
- Does not call `onSave` when date is empty.
- Calls `onCancel` when Cancel is clicked.
- Disables buttons when `isPending` is true.

### `app/(dashboard)/meetings/MeetingRow.test.tsx`

- Does not render action buttons when `canSchedule` is false.
- Does not render action buttons when `meeting.status !== "pending"`.
- Clicking "Cancel" shows `InlineConfirm`.
- Clicking "Dismiss" in confirm strip returns to default mode.
- Clicking "Reschedule" shows `InlineDateInput`.
- Clicking "Cancel" in date input returns to default mode.

---

## Deferred — Follow-up Items

### 6. Reminder-sent audit trail on cancel

If `reminder_sent_at` is set on a meeting (a reminder email has already been sent to homeowners), cancelling the meeting hard-deletes the only record that the reminder existed. The secretary has no way to know a cancellation notice needs to go out, or to confirm a prior notice was sent.

**Suggested follow-up:** Before allowing cancel, check `reminder_sent_at`. If set, show a warning: "A reminder email was already sent for this meeting. Make sure to notify homeowners of the cancellation before proceeding." Could escalate to a block (require explicit acknowledgment checkbox) in a future spec.

### 7. `PreMeetingForm` stale client state after reschedule

`PreMeetingForm` is a Client Component that initialises its date quick-select options from server-rendered props at page load. After a meeting is rescheduled via the meetings page, users already open on `/board/[position]` will still see the old date in the quick-select until they do a full page reload. `revalidatePath` on the server does not push updates to already-rendered client components.

**Suggested follow-up:** Either add a `router.refresh()` call from `MeetingRow` after a successful reschedule (forces RSC re-fetch for any open tab on the same path), or accept the stale state as a minor UX issue given the internal-tool context.
