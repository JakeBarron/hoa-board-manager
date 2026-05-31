# Meeting Cancel & Reschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cancel and reschedule actions to pending meeting rows in the meetings list, with hardened server actions and a new RLS DELETE policy.

**Architecture:** Two new reusable `components/hoa/` presentational components (`InlineConfirm`, `InlineDateInput`) power an extracted `MeetingRow` client component that owns inline mode state. `cancelMeeting` is hardened with a status guard; `rescheduleMeeting` is a new action with date validation, conflict detection, and a race-condition guard. A new Supabase migration adds an RLS DELETE policy that currently doesn't exist.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), shadcn/ui v4 (`@base-ui/react`), React `useTransition`, Jest + React Testing Library.

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| New | `supabase/migrations/0011_meetings_delete_policy.sql` | RLS DELETE policy for meetings |
| New | `actions/meetings.test.ts` | Tests for `cancelMeeting` + `rescheduleMeeting` |
| Modify | `actions/meetings.ts` | Harden `cancelMeeting`; add `rescheduleMeeting` |
| New | `components/hoa/InlineConfirm.tsx` | Reusable destructive-action confirm strip |
| New | `components/hoa/InlineConfirm.test.tsx` | Tests for InlineConfirm |
| New | `components/hoa/InlineDateInput.tsx` | Reusable inline date editor |
| New | `components/hoa/InlineDateInput.test.tsx` | Tests for InlineDateInput |
| New | `app/(dashboard)/meetings/MeetingRow.tsx` | Extracted client component with mode state |
| New | `app/(dashboard)/meetings/MeetingRow.test.tsx` | Tests for MeetingRow |
| Modify | `app/(dashboard)/meetings/MeetingListClient.tsx` | Import MeetingRow; pass canSchedule |
| Modify | `components/hoa/index.ts` | Export InlineConfirm and InlineDateInput |

---

## Task 1: DB Migration — RLS DELETE Policy

**Files:**
- Create: `supabase/migrations/0011_meetings_delete_policy.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Restrict DELETE on meetings to officer and president roles,
-- and only for pending meetings. Previously no DELETE policy existed,
-- so any authenticated user could delete any meeting row.
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

- [ ] **Step 2: Run in Supabase SQL editor**

Open the Supabase dashboard → SQL Editor → paste and run the migration. Verify it appears in the policies list for the `meetings` table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_meetings_delete_policy.sql
git commit -m "feat: add RLS DELETE policy for meetings — officer/president, pending only"
```

---

## Task 2: Harden `cancelMeeting` + Tests

**Files:**
- Modify: `actions/meetings.ts:153-164`
- Create: `actions/meetings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `actions/meetings.test.ts`:

```ts
import { cancelMeeting } from "./meetings";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/supabase/server");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["from", "select", "update", "delete", "insert", "eq", "neq", "in", "limit", "order", "maybeSingle", "single"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  return Object.assign(chain, overrides);
}

describe("cancelMeeting", () => {
  let mockChain: ReturnType<typeof buildChain>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = buildChain();
    (createClient as jest.Mock).mockResolvedValue({ from: jest.fn().mockReturnValue(mockChain) });
  });

  it("throws when the meeting is not in a cancellable state (no rows deleted)", async () => {
    mockChain.select.mockResolvedValue({ data: [], error: null });
    await expect(cancelMeeting("meeting-1")).rejects.toThrow("Meeting is not in a cancellable state");
  });

  it("throws when Supabase returns an error", async () => {
    mockChain.select.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(cancelMeeting("meeting-1")).rejects.toThrow("DB error");
  });

  it("resolves and calls revalidatePath on success", async () => {
    mockChain.select.mockResolvedValue({ data: [{ id: "meeting-1" }], error: null });
    await expect(cancelMeeting("meeting-1")).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test actions/meetings.test.ts
```

Expected: FAIL — `cancelMeeting` doesn't yet have the status guard or row count check.

- [ ] **Step 3: Harden `cancelMeeting` in `actions/meetings.ts`**

Replace the current `cancelMeeting` implementation (lines 153–164):

```ts
/**
 * Hard-deletes a pending meeting and all related records (motions, votes,
 * documents, action items). Only operates on pending meetings — throws if
 * the meeting is not in a cancellable state (e.g. in_progress or already
 * adjourned). On-delete-cascade in the DB handles child record cleanup.
 *
 * @param meetingId - UUID of the pending meeting to permanently delete
 */
export async function cancelMeeting(meetingId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId)
    .eq("status", "pending" satisfies MeetingStatus)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Meeting is not in a cancellable state");

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test actions/meetings.test.ts
```

Expected: all `cancelMeeting` tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
pnpm test --ci
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add actions/meetings.ts actions/meetings.test.ts
git commit -m "feat: harden cancelMeeting with pending status guard and row count check"
```

---

## Task 3: Add `rescheduleMeeting` + Tests

**Files:**
- Modify: `actions/meetings.ts` (append)
- Modify: `actions/meetings.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `actions/meetings.test.ts`:

```ts
import { cancelMeeting, rescheduleMeeting } from "./meetings";
// (update the import at the top of the file — add rescheduleMeeting)
```

Add this `describe` block after the `cancelMeeting` describe:

```ts
describe("rescheduleMeeting", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  it("throws on an invalid date string", async () => {
    await expect(rescheduleMeeting("meeting-1", "not-a-date")).rejects.toThrow("Invalid date");
  });

  it("throws when date is today or in the past", async () => {
    const today = new Date().toISOString().split("T")[0];
    await expect(rescheduleMeeting("meeting-1", today)).rejects.toThrow("Date must be in the future");
  });

  it("throws when another meeting is already scheduled on that date", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: "other-meeting" }, error: null }) });
    mockFrom.mockReturnValue(conflictChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("A meeting is already scheduled for that date");
  });

  it("throws when meeting is not pending (race condition guard)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("Meeting is not in a reschedulable state");
  });

  it("resolves and revalidates paths on success", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [{ id: "meeting-1" }], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/pre-meeting");
    expect(revalidatePath).toHaveBeenCalledWith("/agenda");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test actions/meetings.test.ts
```

Expected: FAIL — `rescheduleMeeting` is not exported from `actions/meetings.ts`.

- [ ] **Step 3: Implement `rescheduleMeeting` in `actions/meetings.ts`**

Append after the last function in the file:

```ts
/**
 * Reschedules a pending meeting to a new date.
 * Validates that the date is in the future and that no other meeting is
 * already scheduled on that date. Guards against race conditions by checking
 * that the row is still pending at update time.
 *
 * @param meetingId - UUID of the pending meeting to reschedule
 * @param newDate   - ISO date string (YYYY-MM-DD) for the new meeting date
 */
export async function rescheduleMeeting(
  meetingId: string,
  newDate: string
): Promise<void> {
  const parsed = new Date(newDate + "T00:00:00");
  if (isNaN(parsed.getTime())) throw new Error("Invalid date");

  const today = new Date().toISOString().split("T")[0];
  if (newDate <= today) throw new Error("Date must be in the future");

  const supabase = await createClient();

  const { data: conflict, error: conflictError } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_date", newDate)
    .in("status", ["pending", "in_progress"] as MeetingStatus[])
    .neq("id", meetingId)
    .maybeSingle();

  if (conflictError) throw new Error(conflictError.message);
  if (conflict) throw new Error("A meeting is already scheduled for that date");

  const { data, error } = await supabase
    .from("meetings")
    .update({ meeting_date: newDate })
    .eq("id", meetingId)
    .eq("status", "pending" satisfies MeetingStatus)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Meeting is not in a reschedulable state");

  revalidatePath("/meetings");
  revalidatePath("/pre-meeting");
  revalidatePath("/agenda");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test actions/meetings.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --ci
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add actions/meetings.ts actions/meetings.test.ts
git commit -m "feat: add rescheduleMeeting server action with validation and conflict guard"
```

---

## Task 4: `InlineConfirm` Component + Tests

**Files:**
- Create: `components/hoa/InlineConfirm.tsx`
- Create: `components/hoa/InlineConfirm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/hoa/InlineConfirm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineConfirm } from "./InlineConfirm";

describe("InlineConfirm", () => {
  const baseProps = {
    message: "Are you sure?",
    onConfirm: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the message and default button labels", () => {
    render(<InlineConfirm {...baseProps} />);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(<InlineConfirm {...baseProps} confirmLabel="Yes, delete" dismissLabel="Never mind" />);
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never mind" })).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm is clicked", async () => {
    render(<InlineConfirm {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Dismiss is clicked", async () => {
    render(<InlineConfirm {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when isPending is true", () => {
    render(<InlineConfirm {...baseProps} isPending />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test components/hoa/InlineConfirm.test.tsx
```

Expected: FAIL — `InlineConfirm` does not exist.

- [ ] **Step 3: Implement `InlineConfirm`**

Create `components/hoa/InlineConfirm.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export interface InlineConfirmProps {
  message: string;
  confirmLabel?: string;
  dismissLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}

/**
 * Inline confirmation strip for destructive actions.
 * Renders a message with Confirm and Dismiss buttons in a single row.
 *
 * @param message      - Text describing what will happen on confirm
 * @param confirmLabel - Label for the confirm button (default "Confirm")
 * @param dismissLabel - Label for the dismiss button (default "Dismiss")
 * @param onConfirm    - Called when the user confirms
 * @param onDismiss    - Called when the user dismisses
 * @param isPending    - Disables both buttons while an action is in flight
 */
export function InlineConfirm({
  message,
  confirmLabel = "Confirm",
  dismissLabel = "Dismiss",
  onConfirm,
  onDismiss,
  isPending = false,
}: InlineConfirmProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{message}</span>
      <Button
        size="sm"
        variant="destructive"
        onClick={onConfirm}
        disabled={isPending}
      >
        {confirmLabel}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDismiss}
        disabled={isPending}
      >
        {dismissLabel}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test components/hoa/InlineConfirm.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/hoa/InlineConfirm.tsx components/hoa/InlineConfirm.test.tsx
git commit -m "feat: add InlineConfirm reusable component"
```

---

## Task 5: `InlineDateInput` Component + Tests

**Files:**
- Create: `components/hoa/InlineDateInput.tsx`
- Create: `components/hoa/InlineDateInput.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/hoa/InlineDateInput.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineDateInput } from "./InlineDateInput";

describe("InlineDateInput", () => {
  const baseProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders a date input and Save/Cancel buttons", () => {
    const { container } = render(<InlineDateInput {...baseProps} />);
    expect(container.querySelector("input[type='date']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onSave with the selected date when Save is clicked", async () => {
    const minDate = "2026-06-01";
    const { container } = render(<InlineDateInput {...baseProps} minDate={minDate} />);
    const input = container.querySelector("input[type='date']") as HTMLInputElement;
    // fireEvent.change is required for date inputs in jsdom — userEvent.type does not work
    fireEvent.change(input, { target: { value: "2026-06-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(baseProps.onSave).toHaveBeenCalledWith("2026-06-10");
  });

  it("does not call onSave when no date is selected", async () => {
    render(<InlineDateInput {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(baseProps.onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    render(<InlineDateInput {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Save and Cancel when isPending is true", () => {
    render(<InlineDateInput {...baseProps} isPending />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("renders with a pre-filled defaultValue", () => {
    render(<InlineDateInput {...baseProps} defaultValue="2026-07-08" />);
    expect(screen.getByDisplayValue("2026-07-08")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test components/hoa/InlineDateInput.test.tsx
```

Expected: FAIL — `InlineDateInput` does not exist.

- [ ] **Step 3: Implement `InlineDateInput`**

Create `components/hoa/InlineDateInput.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface InlineDateInputProps {
  defaultValue?: string;
  minDate?: string;
  onSave: (date: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

/**
 * Inline date editor with Save and Cancel buttons.
 * Client-side validates that the selected date is non-empty and >= minDate
 * before calling onSave. Defaults minDate to tomorrow if not provided.
 *
 * @param defaultValue - Pre-filled date value (YYYY-MM-DD)
 * @param minDate      - Earliest selectable date (YYYY-MM-DD); defaults to tomorrow
 * @param onSave       - Called with the selected ISO date string when saved
 * @param onCancel     - Called when the user cancels
 * @param isPending    - Disables all controls while an action is in flight
 */
export function InlineDateInput({
  defaultValue = "",
  minDate,
  onSave,
  onCancel,
  isPending = false,
}: InlineDateInputProps) {
  const [value, setValue] = useState(defaultValue);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const effectiveMin = minDate ?? tomorrow.toISOString().split("T")[0];

  const isValid = Boolean(value) && value >= effectiveMin;

  return (
    <div className="flex items-center gap-2 py-2 px-1">
      <input
        type="date"
        value={value}
        min={effectiveMin}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        size="sm"
        onClick={() => onSave(value)}
        disabled={!isValid || isPending}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
        Cancel
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test components/hoa/InlineDateInput.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/hoa/InlineDateInput.tsx components/hoa/InlineDateInput.test.tsx
git commit -m "feat: add InlineDateInput reusable component"
```

---

## Task 6: Extract `MeetingRow` + Wire Actions + Update Exports

**Files:**
- Create: `app/(dashboard)/meetings/MeetingRow.tsx`
- Create: `app/(dashboard)/meetings/MeetingRow.test.tsx`
- Modify: `app/(dashboard)/meetings/MeetingListClient.tsx`
- Modify: `components/hoa/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/(dashboard)/meetings/MeetingRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingRow } from "./MeetingRow";

jest.mock("@/actions/meetings", () => ({
  cancelMeeting: jest.fn().mockResolvedValue(undefined),
  rescheduleMeeting: jest.fn().mockResolvedValue(undefined),
}));

const pendingMeeting = {
  id: "meeting-1",
  meeting_date: "2026-07-08",
  status: "pending" as const,
};

const adjournedMeeting = {
  id: "meeting-2",
  meeting_date: "2026-06-03",
  status: "adjourned" as const,
};

describe("MeetingRow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not render action buttons when canSchedule is false", () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={false} />);
    expect(screen.queryByRole("button", { name: /reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("does not render action buttons when meeting status is not pending", () => {
    render(<MeetingRow meeting={adjournedMeeting} canSchedule={true} />);
    expect(screen.queryByRole("button", { name: /reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("renders Reschedule and Cancel buttons for pending meetings when canSchedule is true", () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("clicking Cancel shows the InlineConfirm strip", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText(/cancel the.*meeting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("clicking Dismiss in the confirm strip returns to default mode", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByText(/cancel the.*meeting/i)).not.toBeInTheDocument();
  });

  it("clicking Reschedule shows the InlineDateInput", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("clicking Cancel in the date input returns to default mode", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test app/\(dashboard\)/meetings/MeetingRow.test.tsx
```

Expected: FAIL — `MeetingRow` does not exist at that path.

- [ ] **Step 3: Create `MeetingRow.tsx`**

Create `app/(dashboard)/meetings/MeetingRow.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { InlineDateInput } from "@/components/hoa/InlineDateInput";
import { cancelMeeting, rescheduleMeeting } from "@/actions/meetings";
import { formatMeetingDate } from "@/lib/dates";
import type { Meeting } from "@/types/database";
import type { AppStatus } from "@/components/hoa/StatusBadge";

type RowMode = "default" | "confirmCancel" | "reschedule";

interface MeetingRowProps {
  meeting: Pick<Meeting, "id" | "meeting_date" | "status">;
  /** Whether the current user has officer/president permission to cancel or reschedule */
  canSchedule: boolean;
}

/**
 * Single row in the meetings list. Renders a link to /meetings/[id] with a
 * StatusBadge. For pending meetings when canSchedule is true, shows inline
 * Reschedule and Cancel actions that expand in-place without a modal.
 *
 * @param meeting     - Partial meeting row with id, meeting_date, and status
 * @param canSchedule - Whether the current user can cancel or reschedule
 */
export function MeetingRow({ meeting, canSchedule }: MeetingRowProps) {
  const [mode, setMode] = useState<RowMode>("default");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showActions = canSchedule && meeting.status === "pending";

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      try {
        await cancelMeeting(meeting.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel meeting.");
        setMode("default");
      }
    });
  };

  const handleReschedule = (newDate: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await rescheduleMeeting(meeting.id, newDate);
        setMode("default");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reschedule meeting.");
      }
    });
  };

  return (
    <li>
      <div className="flex items-center justify-between py-3 px-1">
        <Link
          href={`/meetings/${meeting.id}`}
          className="text-sm font-medium hover:underline"
        >
          {formatMeetingDate(meeting.meeting_date)}
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={meeting.status as AppStatus} />
          {showActions && mode === "default" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setError(null); setMode("reschedule"); }}
              >
                Reschedule
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setError(null); setMode("confirmCancel"); }}
              >
                Cancel
              </Button>
            </>
          )}
          {showActions && mode === "confirmCancel" && (
            <InlineConfirm
              message={`Cancel the ${formatMeetingDate(meeting.meeting_date)} meeting?`}
              confirmLabel="Yes, cancel"
              onConfirm={handleCancel}
              onDismiss={() => { setMode("default"); setError(null); }}
              isPending={isPending}
            />
          )}
        </div>
      </div>
      {showActions && mode === "reschedule" && (
        <InlineDateInput
          onSave={handleReschedule}
          onCancel={() => { setMode("default"); setError(null); }}
          isPending={isPending}
        />
      )}
      {error && (
        <p role="alert" className="px-1 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test app/\(dashboard\)/meetings/MeetingRow.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Update `MeetingListClient.tsx`**

In `app/(dashboard)/meetings/MeetingListClient.tsx`:

1. Add the import at the top (with the other imports):

```ts
import { MeetingRow } from "./MeetingRow";
```

2. In `upcoming.map(...)` (currently around line 143), replace `<MeetingRow key={m.id} meeting={m} />` with:

```tsx
<MeetingRow key={m.id} meeting={m} canSchedule={canSchedule} />
```

3. In `past.map(...)` (around line 154), replace `<MeetingRow key={m.id} meeting={m} />` with:

```tsx
<MeetingRow key={m.id} meeting={m} canSchedule={false} />
```

4. Delete the inline `MeetingRow` function at the bottom of the file (the entire block from `/** Single row... */` through the closing `}`).

- [ ] **Step 6: Export new components from `components/hoa/index.ts`**

Append to `components/hoa/index.ts`:

```ts
export { InlineConfirm } from "./InlineConfirm";
export type { InlineConfirmProps } from "./InlineConfirm";
export { InlineDateInput } from "./InlineDateInput";
export type { InlineDateInputProps } from "./InlineDateInput";
```

- [ ] **Step 7: Run the full test suite**

```bash
pnpm test --ci
```

Expected: all tests pass.

- [ ] **Step 8: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/\(dashboard\)/meetings/MeetingRow.tsx app/\(dashboard\)/meetings/MeetingRow.test.tsx app/\(dashboard\)/meetings/MeetingListClient.tsx components/hoa/index.ts
git commit -m "feat: add cancel and reschedule to pending meeting rows"
```

---

## Task 7: Manual Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Sign in as President and verify the feature**

1. Navigate to `http://localhost:3000/meetings`.
2. Confirm upcoming pending meetings show **Reschedule** and **Cancel** buttons.
3. Click **Cancel** → confirm strip appears with "Cancel the [date] meeting?" and "Yes, cancel" / "Dismiss" buttons.
4. Click **Dismiss** → confirm strip disappears, buttons return.
5. Click **Cancel** → **Yes, cancel** → meeting row disappears from the list.
6. Schedule a new meeting via "Schedule meeting". Confirm it appears as pending with action buttons.
7. Click **Reschedule** → date input appears below the row.
8. Pick a date that already has a meeting → click Save → error "A meeting is already scheduled for that date" appears inline.
9. Pick a valid future date → Save → row updates to the new date, date input closes.
10. Confirm past and adjourned meetings show **no** action buttons.

- [ ] **Step 3: Sign in as Treasurer (member role) and verify**

Navigate to `/meetings`. Confirm **no** Reschedule or Cancel buttons appear on any row.

- [ ] **Step 4: Stop the dev server and commit if any fixes were needed**

If no fixes were needed, no commit required here. If you fixed anything, commit with a descriptive message.
