# Meetings Schedule Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate `/meetings/new` scheduling page with a modal dialog on the meetings list, pre-filled to the next available cadence date, while also enabling cancel/reschedule on past pending meetings and blocking past-date scheduling.

**Architecture:** `createMeeting` gains date-validation guards (matching `rescheduleMeeting`). `MeetingsPage` computes a `defaultScheduleDate` from the cadence setting and passes it to `MeetingListClient`. `MeetingListClient` gains a `ScheduleMeetingModal` (simple fixed-overlay dialog), button reorder, and passes `canSchedule` to past rows. The `/meetings/new` route becomes a redirect and `MeetingScheduleForm` is deleted.

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, Tailwind CSS v4, shadcn/ui v4 (`@base-ui/react`), Jest + React Testing Library.

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `actions/meetings.ts` | Harden `createMeeting` with past-date + conflict guards |
| Modify | `actions/meetings.test.ts` | Add `createMeeting` tests |
| New | `components/hoa/ScheduleMeetingModal.tsx` | Simple modal dialog for scheduling |
| New | `components/hoa/ScheduleMeetingModal.test.tsx` | Tests for modal |
| Modify | `components/hoa/index.ts` | Export `ScheduleMeetingModal` |
| Modify | `app/(dashboard)/meetings/page.tsx` | Add cadence query + compute `defaultScheduleDate` |
| Modify | `app/(dashboard)/meetings/MeetingListClient.tsx` | Modal integration, button reorder, past rows fix |
| Modify | `app/(dashboard)/meetings/new/page.tsx` | Replace with redirect to `/meetings` |
| Delete | `components/hoa/MeetingScheduleForm.tsx` | No longer referenced |

---

## Task 1: Harden `createMeeting` + Tests

**Files:**
- Modify: `actions/meetings.ts` — `createMeeting` function
- Modify: `actions/meetings.test.ts` — add `createMeeting` describe block

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `actions/meetings.test.ts`. First update the top-level import to include `createMeeting`:

```ts
import { cancelMeeting, rescheduleMeeting, createMeeting } from "./meetings";
```

Then append after the `rescheduleMeeting` describe:

```ts
describe("createMeeting", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  it("throws when date is in the past", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split("T")[0];
    await expect(createMeeting("pos-1", pastDate)).rejects.toThrow("Date must be in the future");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when a meeting is already scheduled on that date", async () => {
    const futureDate = getFutureDate();
    const conflictChain = buildChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
    });
    mockFrom.mockReturnValue(conflictChain);
    await expect(createMeeting("pos-1", futureDate)).rejects.toThrow("A meeting is already scheduled for that date");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the new meeting id and revalidates on success", async () => {
    const futureDate = getFutureDate();
    const conflictChain = buildChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const insertChain = buildChain({
      single: jest.fn().mockResolvedValue({ data: { id: "new-meeting" }, error: null }),
    });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(insertChain);
    const result = await createMeeting("pos-1", futureDate);
    expect(result).toEqual({ id: "new-meeting" });
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
```

> **Note:** `getFutureDate` and `buildChain` are already defined in the file's `rescheduleMeeting` describe block — these tests use them from the same scope. If they're inside the `rescheduleMeeting` describe, move them to the top-level `describe` scope (before any `describe` blocks) so all three suites can use them.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test actions/meetings.test.ts
```

Expected: FAIL — `createMeeting` doesn't yet have the guards.

- [ ] **Step 3: Harden `createMeeting` in `actions/meetings.ts`**

Replace the current `createMeeting` implementation with:

```ts
/**
 * Schedules a new board meeting in 'pending' status.
 * Rejects dates in the past and dates that already have a pending or
 * in_progress meeting scheduled. RLS enforces that only officers and
 * president can insert meetings.
 *
 * @param positionId  - UUID of the board position calling the meeting
 * @param meetingDate - ISO date string (YYYY-MM-DD); must be today or future
 * @returns The newly created meeting row ID
 */
export async function createMeeting(
  positionId: string,
  meetingDate: string
): Promise<{ id: string }> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  if (meetingDate < today) throw new Error("Date must be in the future");

  const supabase = await createClient();

  const { data: conflict, error: conflictError } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_date", meetingDate)
    .in("status", ["pending", "in_progress"] as MeetingStatus[])
    .maybeSingle();

  if (conflictError) throw new Error(conflictError.message);
  if (conflict) throw new Error("A meeting is already scheduled for that date");

  const { data, error } = await supabase
    .from("meetings")
    .insert({ meeting_date: meetingDate, called_by: positionId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { id: data.id };
}
```

- [ ] **Step 4: Move `getFutureDate` and `buildChain` to top-level scope if needed**

If `getFutureDate` or `buildChain` are currently defined inside the `rescheduleMeeting` describe block, move them to the top-level scope (before all describes) so `createMeeting` tests can access them.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test actions/meetings.test.ts
```

Expected: all tests PASS (now 12 total: 3 cancelMeeting + 6 rescheduleMeeting + 3 createMeeting).

- [ ] **Step 6: Full suite check**

```bash
pnpm test --ci && pnpm type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add actions/meetings.ts actions/meetings.test.ts
git commit -m "feat: harden createMeeting with past-date and conflict guards"
```

---

## Task 2: `ScheduleMeetingModal` Component + Tests + Export

**Files:**
- Create: `components/hoa/ScheduleMeetingModal.tsx`
- Create: `components/hoa/ScheduleMeetingModal.test.tsx`
- Modify: `components/hoa/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `components/hoa/ScheduleMeetingModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleMeetingModal } from "./ScheduleMeetingModal";

jest.mock("@/actions/meetings", () => ({
  createMeeting: jest.fn().mockResolvedValue({ id: "new-meeting" }),
}));

const baseProps = {
  positionId: "pos-1",
  defaultDate: "2026-08-12",
  onClose: jest.fn(),
};

describe("ScheduleMeetingModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders with the date input pre-filled to defaultDate", () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    expect(screen.getByDisplayValue("2026-08-12")).toBeInTheDocument();
  });

  it("renders Schedule and Cancel buttons", () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("disables Schedule button when date input is empty", () => {
    render(<ScheduleMeetingModal {...baseProps} defaultDate="" />);
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();
  });

  it("calls createMeeting with positionId and selected date on submit", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(createMeeting).toHaveBeenCalledWith("pos-1", "2026-08-12");
  });

  it("calls onClose after successful submit", async () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("shows an error alert when createMeeting throws", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    createMeeting.mockRejectedValueOnce(new Error("A meeting is already scheduled for that date"));
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A meeting is already scheduled for that date");
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("updates the date when user changes the input", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    const { container } = render(<ScheduleMeetingModal {...baseProps} />);
    const input = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-09-09" } });
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(createMeeting).toHaveBeenCalledWith("pos-1", "2026-09-09");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test components/hoa/ScheduleMeetingModal.test.tsx
```

Expected: FAIL — `ScheduleMeetingModal` does not exist.

- [ ] **Step 3: Create `ScheduleMeetingModal.tsx`**

Create `components/hoa/ScheduleMeetingModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createMeeting } from "@/actions/meetings";

export interface ScheduleMeetingModalProps {
  /** UUID of the current user's board position */
  positionId: string;
  /** ISO date string (YYYY-MM-DD) to pre-fill — computed from meeting cadence */
  defaultDate: string;
  /** Called when the modal should close (success or cancel) */
  onClose: () => void;
}

/**
 * Simple modal dialog for scheduling a new board meeting.
 * Pre-fills the date input with the next available cadence date.
 * Closes on success or when the user clicks Cancel or the backdrop.
 *
 * @param positionId  - UUID of the position calling the meeting
 * @param defaultDate - ISO date pre-filled in the date picker
 * @param onClose     - Called to dismiss the modal
 */
export function ScheduleMeetingModal({
  positionId,
  defaultDate,
  onClose,
}: ScheduleMeetingModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const isValid = Boolean(date) && date >= today;

  const handleSchedule = () => {
    setError(null);
    startTransition(async () => {
      try {
        await createMeeting(positionId, date);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to schedule meeting."
        );
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-base font-semibold">Schedule a Meeting</h2>

        <div className="space-y-1.5">
          <label htmlFor="schedule-date" className="text-sm font-medium">
            Meeting date
          </label>
          <input
            id="schedule-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            disabled={isPending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSchedule}
            disabled={!isValid || isPending}
          >
            {isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Export from `components/hoa/index.ts`**

Append to `components/hoa/index.ts`:

```ts
export { ScheduleMeetingModal } from "./ScheduleMeetingModal";
export type { ScheduleMeetingModalProps } from "./ScheduleMeetingModal";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test components/hoa/ScheduleMeetingModal.test.tsx
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Full suite check**

```bash
pnpm test --ci && pnpm type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add components/hoa/ScheduleMeetingModal.tsx components/hoa/ScheduleMeetingModal.test.tsx components/hoa/index.ts
git commit -m "feat: add ScheduleMeetingModal component"
```

---

## Task 3: Update `MeetingsPage` — Cadence Query + `defaultScheduleDate`

**Files:**
- Modify: `app/(dashboard)/meetings/page.tsx`

- [ ] **Step 1: Add `getUpcomingMeetingDates` import**

In `app/(dashboard)/meetings/page.tsx`, add to the imports at the top:

```ts
import { getUpcomingMeetingDates } from "@/lib/dates";
```

- [ ] **Step 2: Add `meeting_cadence` to the settings query**

Find this line in the `Promise.all`:

```ts
supabase
  .from("settings")
  .select("key, value")
  .in("key", ["hoa_name", "drive_folder_url"]),
```

Replace it with:

```ts
supabase
  .from("settings")
  .select("key, value")
  .in("key", ["hoa_name", "drive_folder_url", "meeting_cadence"]),
```

- [ ] **Step 3: Compute `defaultScheduleDate` and pass it to `MeetingListClient`**

After the `settingsMap`, `hoaName`, and `driveFolder` lines, add:

```ts
const cadence = settingsMap.get("meeting_cadence") ?? "";
const bookedDates = new Set(upcoming.map((m) => m.meeting_date));
const candidateDates = getUpcomingMeetingDates(cadence, 6);
const defaultScheduleDate =
  candidateDates.find((d) => !bookedDates.has(d)) ??
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
```

Then add `defaultScheduleDate` to the `MeetingListClient` props:

```tsx
return (
  <MeetingListClient
    canRun={canRun}
    canSchedule={canSchedule}
    positions={allPositions}
    currentPositionId={position.id}
    existingMeeting={existingMeeting}
    upcoming={upcoming}
    past={past}
    hoaName={hoaName}
    driveFolder={driveFolder}
    defaultScheduleDate={defaultScheduleDate}
  />
);
```

- [ ] **Step 4: Type-check**

```bash
pnpm type-check
```

Expected: TypeScript will complain that `defaultScheduleDate` is not in `MeetingListClientProps` yet — this is expected. The error will resolve in Task 4.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/meetings/page.tsx"
git commit -m "feat: pass defaultScheduleDate from cadence to MeetingListClient"
```

---

## Task 4: Update `MeetingListClient` — Modal, Button Reorder, Past Rows

**Files:**
- Modify: `app/(dashboard)/meetings/MeetingListClient.tsx`

- [ ] **Step 1: Update imports**

In `app/(dashboard)/meetings/MeetingListClient.tsx`:

1. Remove the `Link` import (no longer needed):
   ```ts
   // DELETE this line:
   import Link from "next/link";
   ```

2. Add `ScheduleMeetingModal` import:
   ```ts
   import { ScheduleMeetingModal } from "@/components/hoa/ScheduleMeetingModal";
   ```

- [ ] **Step 2: Add `defaultScheduleDate` to the props interface**

In `MeetingListClientProps`, add:

```ts
/** ISO date (YYYY-MM-DD) pre-filled in the schedule modal — next available cadence date */
defaultScheduleDate: string;
```

And add it to the function signature destructuring:

```ts
export function MeetingListClient({
  canRun,
  canSchedule,
  positions,
  currentPositionId,
  existingMeeting,
  upcoming,
  past,
  driveFolder,
  hoaName,
  defaultScheduleDate,
}: MeetingListClientProps) {
```

Also add `defaultScheduleDate` to the JSDoc `@param` list:
```
 * @param defaultScheduleDate - ISO date pre-filled in the schedule modal (next available cadence date)
```

- [ ] **Step 3: Add `showScheduleModal` state**

After the existing `useState` / `useTransition` declarations, add:

```ts
const [showScheduleModal, setShowScheduleModal] = useState(false);
```

- [ ] **Step 4: Replace the "Schedule meeting" button and reorder**

Replace the `action` block inside `<PageHeader>` (currently lines 97–121). The new version puts "Schedule meeting" first:

```tsx
action={
  canSchedule ? (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowScheduleModal(true)}
      >
        Schedule meeting
      </Button>
      {canRun && (
        <Button
          size="sm"
          variant="default"
          onClick={handleStartMeeting}
          disabled={isPending}
        >
          {isPending ? "Starting…" : "Start Meeting"}
        </Button>
      )}
    </div>
  ) : undefined
}
```

- [ ] **Step 5: Change past rows to pass `canSchedule`**

Find the past rows map (currently `canSchedule={false}`):

```tsx
{past.map((m) => (
  <MeetingRow key={m.id} meeting={m} canSchedule={false} />
))}
```

Replace with:

```tsx
{past.map((m) => (
  <MeetingRow key={m.id} meeting={m} canSchedule={canSchedule} />
))}
```

- [ ] **Step 6: Add `ScheduleMeetingModal` to the render output**

Inside the `<>` fragment, after the `{modalMeetingId && <MeetingRunnerModal ... />}` block, add:

```tsx
{showScheduleModal && (
  <ScheduleMeetingModal
    positionId={currentPositionId}
    defaultDate={defaultScheduleDate}
    onClose={() => setShowScheduleModal(false)}
  />
)}
```

- [ ] **Step 7: Run the full test suite and type-check**

```bash
pnpm test --ci && pnpm type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/meetings/MeetingListClient.tsx"
git commit -m "feat: replace schedule meeting link with modal, reorder buttons, enable past pending actions"
```

---

## Task 5: Route Cleanup

**Files:**
- Modify: `app/(dashboard)/meetings/new/page.tsx` — replace with redirect
- Delete: `components/hoa/MeetingScheduleForm.tsx`

- [ ] **Step 1: Replace `/meetings/new` with a redirect**

Overwrite `app/(dashboard)/meetings/new/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";

/**
 * The schedule meeting flow has moved inline to /meetings.
 * This redirect preserves any bookmarked or linked URLs.
 */
export default function NewMeetingPage() {
  redirect("/meetings");
}
```

- [ ] **Step 2: Delete `MeetingScheduleForm.tsx`**

```bash
rm components/hoa/MeetingScheduleForm.tsx
```

- [ ] **Step 3: Verify nothing imports `MeetingScheduleForm`**

```bash
grep -r "MeetingScheduleForm" /Users/jake/dev/hoa-board-manager --include="*.ts" --include="*.tsx"
```

Expected: only the now-replaced `/meetings/new/page.tsx` import (which is gone). No other references should exist.

- [ ] **Step 4: Remove `MeetingScheduleForm` from `components/hoa/index.ts` if present**

Check `components/hoa/index.ts` — if it exports `MeetingScheduleForm`, remove that line. (Looking at the current file, it does NOT export `MeetingScheduleForm`, so no change needed.)

- [ ] **Step 5: Run full suite**

```bash
pnpm test --ci && pnpm type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/meetings/new/page.tsx"
git rm "components/hoa/MeetingScheduleForm.tsx"
git commit -m "chore: replace /meetings/new with redirect, delete MeetingScheduleForm"
```

---

## Task 6: Manual Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Sign in as President and verify**

Navigate to `http://localhost:3000/meetings`.

1. **Button order**: confirm "Schedule meeting" appears before "Start Meeting" in the top-right.
2. **Schedule modal**: click "Schedule meeting" → modal opens with a date pre-filled to the next 2nd Tuesday (or whatever the cadence is in settings). The date should be in the future.
3. **Past date blocked**: manually type a past date in the input → "Schedule" button stays disabled (the `min` attribute prevents it).
4. **Cancel modal**: click "Cancel" in the modal → modal closes, no meeting created.
5. **Backdrop dismiss**: click the dark backdrop outside the modal → modal closes.
6. **Schedule success**: pick a valid future date not already on the list → click "Schedule" → modal closes, new meeting appears in Upcoming with "Pending" badge and Reschedule/Cancel buttons.
7. **Conflict error**: try to schedule a meeting on a date that already has one → error appears inline in the modal ("A meeting is already scheduled for that date").
8. **Past pending cancel**: if there is a meeting in the Past section with "Pending" status → confirm Cancel and Reschedule buttons appear on it. (If none exist, create one by directly inserting a past-dated pending meeting in Supabase, or verify via the RLS migration that the feature is gated correctly.)
9. **Past adjourned**: confirm adjourned past meetings show no action buttons.
10. **`/meetings/new` redirect**: navigate to `http://localhost:3000/meetings/new` → confirm it redirects to `/meetings`.
11. **Treasurer (member)**: sign in as `treasurer@yourhoa.com` → confirm no "Schedule meeting" button and no action buttons on any rows.

- [ ] **Step 3: Stop dev server and commit any fixes**

If smoke test revealed any issues, fix and commit. If clean, no commit needed.
