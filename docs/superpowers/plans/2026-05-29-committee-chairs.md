# Committee Chairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five non-voting committee chair accounts (web, architecture, welcoming, clubhouse, cra) with login access, a dedicated section page at `/committee/[chair]`, and integrate their pre-meeting updates into the agenda page.

**Architecture:** Chair accounts live in the existing `positions` table with a new `chair` role. All route protection is per-page (same pattern as the existing member redirect on pre-meeting). The `/architecture` dashboard page is removed — its functionality moves to `/committee/architecture`. The agenda page gains a Committee Reports section and three separate reminder buttons (board, chairs, all).

**Tech Stack:** Next.js 16 App Router (Server Components), Supabase, TypeScript, Tailwind CSS v4, shadcn/ui v4, Jest + React Testing Library

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0009_committee_chairs.sql` | Create | DB schema changes |
| `types/database.ts` | Modify | PositionRole + PositionName + meetings.reminder_sent_at |
| `lib/permissions.ts` | Modify | Add `isChair` helper |
| `lib/permissions.test.ts` | Modify | Cover `isChair` + chair cases |
| `lib/reminder.ts` | Modify | Add `updateUrl` param + 5 chair labels |
| `lib/reminder.test.ts` | Create | Tests for reminder builder |
| `actions/meetings.ts` | Modify | Add `recordReminderSent` |
| `components/hoa/Sidebar.tsx` | Modify | Committee Chairs section + chair minimal nav |
| `components/hoa/Sidebar.test.tsx` | Create | Sidebar role-based rendering |
| `supabase/seed.ts` | Modify | 5 new chair accounts |
| `app/(dashboard)/committee/[chair]/page.tsx` | Create | Chair section page |
| `app/(dashboard)/architecture/page.tsx` | Delete | Merged into committee page |
| `app/(dashboard)/architecture/new/page.tsx` | Delete | Merged into committee page |
| `app/(dashboard)/agenda/page.tsx` | Modify | Committee Reports + 3 reminder buttons + sent warning |
| `app/(dashboard)/pre-meeting/page.tsx` | Modify | Chair redirect + filter positions to voting members |
| `app/(dashboard)/meetings/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/meetings/new/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/meetings/[id]/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/board/[position]/page.tsx` | Modify | Chair redirect + BoardPositionName alias |
| `app/(dashboard)/board/[position]/minutes/page.tsx` | Modify | Chair redirect + BoardPositionName alias |
| `app/(dashboard)/board/[position]/minutes/new/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/board/[position]/todos/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/cra/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/cra/new/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/admin/positions/page.tsx` | Modify | Chair redirect |
| `app/(dashboard)/admin/settings/page.tsx` | Modify | Chair redirect |

---

## Task 1: Migration and DB types

**Files:**
- Create: `supabase/migrations/0009_committee_chairs.sql`
- Modify: `types/database.ts`

- [ ] **Step 1.1: Write the migration**

Create `supabase/migrations/0009_committee_chairs.sql`:

```sql
-- Add chair role and five committee chair positions.
-- Also adds reminder_sent_at to meetings for reminder tracking.

-- ─── Extend role constraint ───────────────────────────────────────────────────
alter table positions drop constraint positions_role_check;
alter table positions add constraint positions_role_check
  check (role in ('president','officer','member','chair'));

-- ─── Extend name constraint ───────────────────────────────────────────────────
alter table positions drop constraint positions_name_check;
alter table positions add constraint positions_name_check
  check (name in (
    'president','vp','secretary','treasurer',
    'pool','membership','tennis','social',
    'web','architecture','welcoming','clubhouse','cra'
  ));

-- ─── Reminder tracking on meetings ───────────────────────────────────────────
alter table meetings
  add column reminder_sent_at timestamptz default null;

-- ─── Insert the five chair position rows ─────────────────────────────────────
-- Auth accounts are created separately via pnpm seed.
insert into positions (name, email, role) values
  ('web',          'web@yourhoa.com',          'chair'),
  ('architecture', 'architecture@yourhoa.com', 'chair'),
  ('welcoming',    'welcoming@yourhoa.com',    'chair'),
  ('clubhouse',    'clubhouse@yourhoa.com',    'chair'),
  ('cra',          'cra@yourhoa.com',          'chair');
```

> **Manual step — run this in the Supabase SQL editor before proceeding.**

- [ ] **Step 1.2: Update `types/database.ts`**

Add `"chair"` to `PositionRole`, add 5 names to `PositionName`, and add `reminder_sent_at` to the meetings table type:

```ts
// PositionRole — line ~425
export type PositionRole = "president" | "officer" | "member" | "chair";

// PositionName — line ~427
export type PositionName =
  | "president"
  | "vp"
  | "secretary"
  | "treasurer"
  | "pool"
  | "membership"
  | "tennis"
  | "social"
  | "web"
  | "architecture"
  | "welcoming"
  | "clubhouse"
  | "cra";
```

In the `meetings` table type, add `reminder_sent_at` to `Row` and `Update`:

```ts
// meetings.Row — add after minutes_drive_url
reminder_sent_at: string | null;

// meetings.Update — add after minutes_drive_url
reminder_sent_at?: string | null;
```

- [ ] **Step 1.3: Type-check**

```bash
pnpm type-check
```

Expected: errors only about `Record<PositionName, string>` maps missing the 5 new entries — these will be fixed in later tasks. If there are unexpected errors, investigate before continuing.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/0009_committee_chairs.sql types/database.ts
git commit -m "feat: add chair role and committee positions to DB types"
```

---

## Task 2: `isChair` permission helper

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/permissions.test.ts`

- [ ] **Step 2.1: Write the failing test**

Add to `lib/permissions.test.ts`:

```ts
describe("isChair", () => {
  it("returns true for chair role", () => expect(isChair("chair")).toBe(true));
  it("returns false for president", () => expect(isChair("president")).toBe(false));
  it("returns false for officer", () => expect(isChair("officer")).toBe(false));
  it("returns false for member", () => expect(isChair("member")).toBe(false));
});
```

Also update the import at the top of the file to include `isChair`:

```ts
import {
  canEditAll,
  canEditSection,
  isAdmin,
  canEditCRA,
  canRecordVote,
  isChair,
} from "./permissions";
```

Add chair cases to existing describes so they don't silently pass for the new role:

```ts
// inside describe("canEditAll")
it("returns false for chair", () => expect(canEditAll("chair")).toBe(false));

// inside describe("isAdmin")
it("returns false for chair", () => expect(isAdmin("chair")).toBe(false));

// inside describe("canEditCRA")
it("prevents chairs from editing CRA", () => expect(canEditCRA("chair")).toBe(false));

// inside describe("canRecordVote")
it("returns false for chair", () => expect(canRecordVote("chair")).toBe(false));
```

- [ ] **Step 2.2: Run test to confirm failure**

```bash
pnpm test lib/permissions.test.ts
```

Expected: `isChair is not a function` or similar — the test can't find the export yet.

- [ ] **Step 2.3: Add `isChair` to `lib/permissions.ts`**

Add after `canRecordVote`:

```ts
/**
 * Returns true if the role is a non-voting committee chair.
 * Chairs can only edit their own section and cannot access most board routes.
 *
 * @param role - The current user's position role
 */
export const isChair = (role: PositionRole): boolean => role === "chair";
```

- [ ] **Step 2.4: Run tests to confirm pass**

```bash
pnpm test lib/permissions.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat: add isChair permission helper"
```

---

## Task 3: `buildReminderMailto` update

**Files:**
- Modify: `lib/reminder.ts`
- Create: `lib/reminder.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `lib/reminder.test.ts`:

```ts
import { buildReminderMailto } from "./reminder";

const BASE_PARAMS = {
  meetingDate: "2026-06-02",
  boardEmails: ["president@yourhoa.com", "vp@yourhoa.com"],
  missingPositions: ["vp" as const],
  appUrl: "https://board.example.com",
};

describe("buildReminderMailto", () => {
  it("returns a mailto: URL", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toMatch(/^mailto:/);
  });

  it("includes all board emails in the To: field", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain("president%40yourhoa.com");
    expect(result).toContain("vp%40yourhoa.com");
  });

  it("includes the meeting date in the subject", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain(encodeURIComponent("2026-06-02").slice(0, 4));
  });

  it("links to /pre-meeting by default", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain(encodeURIComponent("/pre-meeting"));
  });

  it("uses updateUrl override when provided", () => {
    const result = buildReminderMailto({
      ...BASE_PARAMS,
      updateUrl: "https://board.example.com/dashboard",
    });
    expect(result).toContain(encodeURIComponent("/dashboard"));
    expect(result).not.toContain(encodeURIComponent("/pre-meeting"));
  });

  it("lists missing board positions by label", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(decodeURIComponent(result)).toContain("Vice President");
  });

  it("lists missing chair positions by label", () => {
    const result = buildReminderMailto({
      ...BASE_PARAMS,
      missingPositions: ["web" as const],
    });
    expect(decodeURIComponent(result)).toContain("Web Committee");
  });
});
```

- [ ] **Step 3.2: Run tests to confirm failure**

```bash
pnpm test lib/reminder.test.ts
```

Expected: failures because `buildReminderMailto` doesn't accept `updateUrl` and `POSITION_LABELS` doesn't have chair entries.

- [ ] **Step 3.3: Update `lib/reminder.ts`**

Replace the file with:

```ts
import type { PositionName } from "@/types/database";
import { formatMeetingDate } from "@/lib/dates";

const POSITION_LABELS: Record<PositionName, string> = {
  president:    "President",
  vp:           "Vice President",
  secretary:    "Secretary",
  treasurer:    "Treasurer",
  pool:         "Pool",
  membership:   "Membership",
  tennis:       "Tennis",
  social:       "Social",
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};

interface ReminderParams {
  meetingDate: string;
  boardEmails: string[];
  missingPositions: PositionName[];
  appUrl: string;
  /** Overrides the default /pre-meeting?date=... link in the email body. */
  updateUrl?: string;
}

/**
 * Builds a pre-filled mailto: URL for a board meeting reminder email.
 * Opens the user's email client with the given recipients in To:, the meeting
 * date in the subject, and a link to the pre-meeting update form in the body.
 *
 * @param meetingDate      - ISO date string (YYYY-MM-DD)
 * @param boardEmails      - Email addresses for the To: field
 * @param missingPositions - Positions that have not yet submitted an update
 * @param appUrl           - Base URL of the app (e.g. "https://example.com")
 * @param updateUrl        - Optional override for the update link in the body
 * @returns A mailto: URL string safe for use in an href
 */
export function buildReminderMailto({
  meetingDate,
  boardEmails,
  missingPositions,
  appUrl,
  updateUrl,
}: ReminderParams): string {
  const dateLabel = formatMeetingDate(meetingDate);
  const subject = `Board Meeting Reminder — ${dateLabel}`;
  const submitUrl = updateUrl ?? `${appUrl}/pre-meeting?date=${meetingDate}`;

  const missingSection =
    missingPositions.length > 0
      ? `\n\nNot yet submitted:\n${missingPositions
          .map((p) => `  - ${POSITION_LABELS[p]}`)
          .join("\n")}`
      : "";

  const body =
    `Reminder: Board meeting on ${dateLabel}.\n\n` +
    `Please submit your pre-meeting status update before the meeting:\n` +
    `${submitUrl}${missingSection}\n\nThank you.`;

  return `mailto:${boardEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

- [ ] **Step 3.4: Run tests to confirm pass**

```bash
pnpm test lib/reminder.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add lib/reminder.ts lib/reminder.test.ts
git commit -m "feat: add updateUrl param and chair labels to buildReminderMailto"
```

---

## Task 4: `recordReminderSent` server action

**Files:**
- Modify: `actions/meetings.ts`

- [ ] **Step 4.1: Add the action to `actions/meetings.ts`**

Add after `addMeetingDocument`:

```ts
/**
 * Records that a pre-meeting reminder email was sent for the given meeting.
 * Sets reminder_sent_at to now — used to show a warning on the agenda page
 * so the secretary doesn't send the reminder multiple times.
 *
 * @param meetingId - UUID of the meeting for which the reminder was sent
 */
export async function recordReminderSent(meetingId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}
```

- [ ] **Step 4.2: Type-check**

```bash
pnpm type-check
```

Expected: clean (the `reminder_sent_at` field was added to the type in Task 1).

- [ ] **Step 4.3: Commit**

```bash
git add actions/meetings.ts
git commit -m "feat: add recordReminderSent server action"
```

---

## Task 5: Sidebar

**Files:**
- Modify: `components/hoa/Sidebar.tsx`
- Create: `components/hoa/Sidebar.test.tsx`

- [ ] **Step 5.1: Write the failing tests**

Create `components/hoa/Sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Position } from "@/types/database";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
jest.mock("@/actions/auth", () => ({ signOut: jest.fn() }));

const makePosition = (overrides: Partial<Position>): Position => ({
  id: "pos-1",
  name: "president",
  email: "president@yourhoa.com",
  role: "president",
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("Sidebar — board member view", () => {
  it("shows Committee Chairs section for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Web Committee" })).toBeInTheDocument();
  });

  it("shows Committee Chairs section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
  });

  it("shows Committee Chairs section for member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.getByText("Committee Chairs")).toBeInTheDocument();
  });

  it("shows Admin section only for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides Admin section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});

describe("Sidebar — chair view", () => {
  it("shows only Dashboard and own section link", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Web Committee" })).toBeInTheDocument();
  });

  it("hides primary nav items from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByRole("link", { name: "Meetings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Agenda" })).not.toBeInTheDocument();
  });

  it("hides Board Sections from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Board Sections")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "President" })).not.toBeInTheDocument();
  });

  it("hides Admin section from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows the correct section link for architecture chair", () => {
    render(<Sidebar position={makePosition({ name: "architecture", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "Architecture Review" })).toHaveAttribute(
      "href",
      "/committee/architecture"
    );
  });
});
```

- [ ] **Step 5.2: Run tests to confirm failure**

```bash
pnpm test components/hoa/Sidebar.test.tsx
```

Expected: tests fail — Sidebar doesn't yet have Committee Chairs section or chair-specific nav.

- [ ] **Step 5.3: Update `components/hoa/Sidebar.tsx`**

Replace the file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/actions/auth";
import { isChair } from "@/lib/permissions";
import type { Position } from "@/types/database";

interface NavItem {
  label: string;
  href: string;
}

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Meetings", href: "/meetings" },
  { label: "CRA Projects", href: "/cra" },
  { label: "Pre-Meeting Update", href: "/pre-meeting" },
  { label: "Agenda", href: "/agenda" },
];

const BOARD_POSITIONS: NavItem[] = [
  { label: "President", href: "/board/president" },
  { label: "Vice President", href: "/board/vp" },
  { label: "Secretary", href: "/board/secretary" },
  { label: "Treasurer", href: "/board/treasurer" },
  { label: "Pool", href: "/board/pool" },
  { label: "Membership", href: "/board/membership" },
  { label: "Tennis", href: "/board/tennis" },
  { label: "Social", href: "/board/social" },
];

const COMMITTEE_CHAIRS: NavItem[] = [
  { label: "Web Committee", href: "/committee/web" },
  { label: "Architecture Review", href: "/committee/architecture" },
  { label: "Welcoming Committee", href: "/committee/welcoming" },
  { label: "Clubhouse Committee", href: "/committee/clubhouse" },
  { label: "CRA Committee", href: "/committee/cra" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Manage Positions", href: "/admin/positions" },
  { label: "Settings", href: "/admin/settings" },
];

const CHAIR_LABELS: Record<string, string> = {
  web: "Web Committee",
  architecture: "Architecture Review",
  welcoming: "Welcoming Committee",
  clubhouse: "Clubhouse Committee",
  cra: "CRA Committee",
};

interface SidebarProps {
  position: Position;
}

/**
 * Fixed left-side navigation for the authenticated dashboard layout.
 * Chairs see only Dashboard and their own section.
 * Board members see the full nav including Committee Chairs section.
 */
export function Sidebar({ position }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  if (isChair(position.role)) {
    return (
      <aside className="flex h-full w-60 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 py-4">
        <div className="mb-4 px-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            HOA Board
          </p>
          <p className="mt-1 text-sm font-medium text-sidebar-foreground">
            Management Portal
          </p>
        </div>
        <nav aria-label="Primary navigation">
          <ul className="space-y-0.5">
            <SidebarLink item={{ label: "Dashboard", href: "/dashboard" }} active={isActive("/dashboard")} />
            <SidebarLink
              item={{ label: CHAIR_LABELS[position.name] ?? position.name, href: `/committee/${position.name}` }}
              active={isActive(`/committee/${position.name}`)}
            />
          </ul>
        </nav>
        <div className="mt-auto pt-4 border-t border-sidebar-border">
          <div className="mb-2 px-2">
            <p className="text-xs text-sidebar-foreground/60">Signed in as</p>
            <p className="text-sm font-medium capitalize text-sidebar-foreground">
              {CHAIR_LABELS[position.name] ?? position.name}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="mb-4 px-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          HOA Board
        </p>
        <p className="mt-1 text-sm font-medium text-sidebar-foreground">
          Management Portal
        </p>
      </div>

      <nav aria-label="Primary navigation">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </ul>
      </nav>

      <div className="mt-4">
        <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Board Sections
        </p>
        <nav aria-label="Board sections">
          <ul className="space-y-0.5">
            {BOARD_POSITIONS.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-4">
        <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Committee Chairs
        </p>
        <nav aria-label="Committee chairs">
          <ul className="space-y-0.5">
            {COMMITTEE_CHAIRS.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </ul>
        </nav>
      </div>

      {position.role === "president" && (
        <div className="mt-4">
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Admin
          </p>
          <nav aria-label="Admin navigation">
            <ul className="space-y-0.5">
              {ADMIN_NAV.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </ul>
          </nav>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <div className="mb-2 px-2">
          <p className="text-xs text-sidebar-foreground/60">Signed in as</p>
          <p className="text-sm font-medium capitalize text-sidebar-foreground">
            {position.name === "vp" ? "Vice President" : position.name}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "block rounded-md px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        {item.label}
      </Link>
    </li>
  );
}
```

- [ ] **Step 5.4: Run tests to confirm pass**

```bash
pnpm test components/hoa/Sidebar.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add components/hoa/Sidebar.tsx components/hoa/Sidebar.test.tsx
git commit -m "feat: add Committee Chairs section and chair minimal nav to Sidebar"
```

---

## Task 6: Seed script

**Files:**
- Modify: `supabase/seed.ts`

- [ ] **Step 6.1: Add 5 chair accounts**

In `supabase/seed.ts`, add to the `positions` array after the existing 8 entries:

```ts
// committee chairs — pre-meeting updates for their section only
{ name: "web",          role: "chair", email: "web@yourhoa.com",          password: "ChangeMe123!" },
{ name: "architecture", role: "chair", email: "architecture@yourhoa.com", password: "ChangeMe123!" },
{ name: "welcoming",    role: "chair", email: "welcoming@yourhoa.com",    password: "ChangeMe123!" },
{ name: "clubhouse",    role: "chair", email: "clubhouse@yourhoa.com",    password: "ChangeMe123!" },
{ name: "cra",          role: "chair", email: "cra@yourhoa.com",          password: "ChangeMe123!" },
```

Also update the JSDoc at the top of the file: change "7 fixed board position accounts" to "13 fixed position accounts (8 board + 5 committee chairs)".

- [ ] **Step 6.2: Type-check**

```bash
pnpm type-check
```

Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
git add supabase/seed.ts
git commit -m "feat: add 5 committee chair accounts to seed script"
```

> **Manual step:** Run `pnpm seed` to create the 5 new auth accounts in Supabase. Safe to run — seed is idempotent and skips existing emails.

---

## Task 7: `/committee/[chair]` page

**Files:**
- Create: `app/(dashboard)/committee/[chair]/page.tsx`

- [ ] **Step 7.1: Create the directory and page**

Create `app/(dashboard)/committee/[chair]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditSection } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { PreMeetingForm } from "@/components/hoa/PreMeetingForm";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getUpcomingMeetingDates, formatMeetingDate } from "@/lib/dates";
import type { PositionName, ArchitectureRequest } from "@/types/database";

type ChairPositionName = "web" | "architecture" | "welcoming" | "clubhouse" | "cra";

const CHAIR_LABELS: Record<ChairPositionName, string> = {
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};

const CHAIR_NAMES = new Set<string>(["web", "architecture", "welcoming", "clubhouse", "cra"]);

interface Props {
  params: Promise<{ chair: string }>;
}

/**
 * Committee chair section page.
 * All chairs get a pre-meeting update widget.
 * The architecture chair additionally sees the architecture requests list.
 *
 * Access rules:
 *   - Chair on their own page: full edit
 *   - President / officer: full edit (same render as chair)
 *   - Voting member: read-only
 *   - Chair on another chair's page: redirect to own page
 */
export default async function CommitteePage({ params }: Props) {
  const { chair } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!CHAIR_NAMES.has(chair)) redirect("/dashboard");

  const [currentPosResult, targetPosResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase.from("positions").select("id, name").eq("name", chair as PositionName).single(),
  ]);

  const currentPosition = currentPosResult.data;
  const targetPosition = targetPosResult.data;

  if (!currentPosition) redirect("/login");
  if (!targetPosition) redirect("/dashboard");

  // Chair visiting another chair's page → redirect to their own
  if (isChair(currentPosition.role) && currentPosition.name !== chair) {
    redirect(`/committee/${currentPosition.name}`);
  }

  const canEdit =
    currentPosition.role === "president" ||
    currentPosition.role === "officer" ||
    currentPosition.id === targetPosition.id;

  const today = new Date().toISOString().split("T")[0];
  const isArchitectureChair = chair === "architecture";

  // Fetch meeting dates and existing update whenever canEdit is true so that
  // officers and president can submit on behalf of a chair, not just the chair themselves.
  const [scheduledMeetingsResult, cadenceResult, archRequestsResult] = await Promise.all([
    canEdit
      ? supabase
          .from("meetings")
          .select("meeting_date")
          .gte("meeting_date", today)
          .in("status", ["pending", "in_progress"])
          .order("meeting_date", { ascending: true })
          .limit(3)
      : Promise.resolve({ data: null }),
    canEdit
      ? supabase.from("settings").select("value").eq("key", "meeting_cadence").single()
      : Promise.resolve({ data: null }),
    isArchitectureChair
      ? supabase
          .from("architecture_requests")
          .select("*")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const cadence = cadenceResult.data?.value ?? "3:2";
  const scheduledDates = (scheduledMeetingsResult.data ?? []).map(
    (m: { meeting_date: string }) => m.meeting_date
  );
  const meetingDates =
    scheduledDates.length > 0 ? scheduledDates : getUpcomingMeetingDates(cadence, 3);
  const nextMeetingDate = meetingDates[0];

  const existingUpdate = canEdit
    ? await supabase
        .from("pre_meeting_updates")
        .select("content")
        .eq("position_id", targetPosition.id)
        .eq("meeting_date", nextMeetingDate)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const archRequests = (archRequestsResult.data ?? []) as ArchitectureRequest[];
  const label = CHAIR_LABELS[chair as ChairPositionName] ?? chair;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} Dashboard`}
        subtitle={`Committee section for ${label}`}
      />

      {canEdit && (
        <SectionCard
          title={`Pre-Meeting Update — ${formatMeetingDate(nextMeetingDate)}`}
          description="Submit your status update before the board meeting."
        >
          <PreMeetingForm
            positionId={targetPosition.id}
            selectedDate={nextMeetingDate}
            upcomingMondays={meetingDates}
            existingContent={existingUpdate?.content ?? undefined}
          />
        </SectionCard>
      )}

      {!canEdit && (
        <SectionCard title="Pre-Meeting Update">
          <p className="text-sm text-muted-foreground">
            View only — you cannot edit this section.
          </p>
        </SectionCard>
      )}

      {isArchitectureChair && (
        <SectionCard
          title="Architecture Requests"
          headerAction={
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/architecture/new" />}>
              Submit New Request
            </Button>
          }
        >
          {archRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No architecture requests on file.</p>
          ) : (
            <ul className="divide-y divide-border">
              {archRequests.map((req) => (
                <li key={req.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{req.address}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={req.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/architecture/${req.id}`} />}
                    >
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
```

- [ ] **Step 7.2: Type-check**

```bash
pnpm type-check
```

Expected: clean, or only an error about the `disabled` prop on `PreMeetingForm` (fix that now if needed).

- [ ] **Step 7.3: Commit**

```bash
git add app/(dashboard)/committee
git commit -m "feat: add /committee/[chair] section page"
```

---

## Task 8: Remove `/architecture` pages and add chair redirects

**Files:**
- Delete: `app/(dashboard)/architecture/page.tsx`
- Delete: `app/(dashboard)/architecture/new/page.tsx`
- Modify: 10 page files (add chair redirect + fix PositionName maps)

### 8a — Delete the architecture dashboard pages

- [ ] **Step 8a.1: Delete the pages**

```bash
rm app/(dashboard)/architecture/page.tsx
rm app/(dashboard)/architecture/new/page.tsx
rmdir app/(dashboard)/architecture 2>/dev/null || true
```

- [ ] **Step 8a.2: Type-check**

```bash
pnpm type-check
```

Expected: clean. If there are import errors referencing the deleted files, fix them.

- [ ] **Step 8a.3: Commit**

```bash
git add -A app/(dashboard)/architecture
git commit -m "feat: remove /architecture dashboard page (moved to /committee/architecture)"
```

### 8b — Add chair redirects and fix PositionName maps

The following pattern goes near the top of each page, after `currentPosition` is fetched:

```ts
import { isChair } from "@/lib/permissions";
// ...
if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);
```

Any `POSITION_LABELS: Record<PositionName, string>` map with only 8 board entries must be narrowed with a local type alias so TypeScript doesn't require all 13 entries:

```ts
type BoardPositionName = Extract<PositionName,
  "president" | "vp" | "secretary" | "treasurer" |
  "pool" | "membership" | "tennis" | "social">;

const POSITION_LABELS: Record<BoardPositionName, string> = {
  president: "President",
  // ... rest of the 8 entries
};
```

- [ ] **Step 8b.1: Add redirect to `app/(dashboard)/meetings/page.tsx`**

After fetching `currentPosition`, add:
```ts
if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);
```

- [ ] **Step 8b.2: Add redirect to `app/(dashboard)/meetings/new/page.tsx`**

Same pattern.

- [ ] **Step 8b.3: Add redirect to `app/(dashboard)/meetings/[id]/page.tsx`**

Same pattern.

- [ ] **Step 8b.4: Add redirect to `app/(dashboard)/board/[position]/page.tsx`**

Add redirect. Also apply the `BoardPositionName` alias to `POSITION_LABELS`.

- [ ] **Step 8b.5: Add redirect to `app/(dashboard)/board/[position]/minutes/page.tsx`**

Add redirect. Also apply the `BoardPositionName` alias to `POSITION_LABELS`.

- [ ] **Step 8b.6: Add redirect to `app/(dashboard)/board/[position]/minutes/new/page.tsx`**

Add redirect.

- [ ] **Step 8b.7: Add redirect to `app/(dashboard)/board/[position]/todos/page.tsx`**

Add redirect.

- [ ] **Step 8b.8: Add redirect to `app/(dashboard)/cra/page.tsx`**

Add redirect.

- [ ] **Step 8b.9: Add redirect to `app/(dashboard)/cra/new/page.tsx`**

Add redirect.

- [ ] **Step 8b.10: Add redirect to `app/(dashboard)/admin/positions/page.tsx`**

Add redirect.

- [ ] **Step 8b.11: Add redirect to `app/(dashboard)/admin/settings/page.tsx`**

Add redirect.

- [ ] **Step 8b.12: Type-check all changes**

```bash
pnpm type-check
```

Expected: clean.

- [ ] **Step 8b.13: Run full test suite**

```bash
pnpm test
```

Expected: all 82 existing tests still pass.

- [ ] **Step 8b.14: Commit**

```bash
git add -A
git commit -m "feat: add chair redirects to all restricted dashboard pages"
```

---

## Task 9: Agenda page — Committee Reports + reminder buttons + sent warning

**Files:**
- Modify: `app/(dashboard)/agenda/page.tsx`

This task replaces the entire agenda page. The new version:
1. Fetches `nextMeeting.reminder_sent_at`
2. Adds `COMMITTEE_ORDER` + `COMMITTEE_LABELS` maps
3. Adds Committee Reports (agenda item 4) with chair updates
4. Updates submission count from hardcoded 8 to derived 13
5. Replaces single reminder button with `ReminderSection` client component (3 buttons + warning)

- [ ] **Step 9.1: Create `app/(dashboard)/agenda/ReminderSection.tsx`**

This client component renders the reminder buttons and records when one is clicked:

```tsx
"use client";

import { recordReminderSent } from "@/actions/meetings";
import { formatMeetingDate } from "@/lib/dates";

interface Props {
  meetingId: string | null;
  reminderSentAt: string | null;
  boardMailto: string | null;
  chairMailto: string | null;
  allMailto: string | null;
  meetingDate: string;
}

/**
 * Reminder buttons for the agenda page.
 * Each link records the send timestamp on click (when a real meeting is scheduled).
 * Shows a warning if a reminder has already been sent.
 */
export function ReminderSection({
  meetingId,
  reminderSentAt,
  boardMailto,
  chairMailto,
  allMailto,
  meetingDate,
}: Props) {
  const handleClick = () => {
    if (meetingId) recordReminderSent(meetingId);
  };

  return (
    <div className="space-y-3">
      {reminderSentAt && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A reminder was last sent on{" "}
          {new Date(reminderSentAt).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          . The buttons below are still active if you need to re-send.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {boardMailto && (
          <a
            href={boardMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind Board
          </a>
        )}
        {chairMailto && (
          <a
            href={chairMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind Chairs
          </a>
        )}
        {allMailto && (
          <a
            href={allMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind All
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2: Update `app/(dashboard)/agenda/page.tsx`**

Replace the file with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { ReminderSection } from "./ReminderSection";
import { formatMeetingDate, getUpcomingMondays } from "@/lib/dates";
import { buildReminderMailto } from "@/lib/reminder";
import type { PositionName } from "@/types/database";

export const metadata = { title: "Meeting Agenda — HOA Board" };

type BoardPositionName = Extract<PositionName,
  "president" | "vp" | "secretary" | "treasurer" |
  "pool" | "membership" | "tennis" | "social">;

type ChairPositionName = Extract<PositionName,
  "web" | "architecture" | "welcoming" | "clubhouse" | "cra">;

const POSITION_ORDER: BoardPositionName[] = [
  "president", "vp", "secretary", "treasurer",
  "pool", "membership", "tennis", "social",
];

const COMMITTEE_ORDER: ChairPositionName[] = [
  "web", "architecture", "welcoming", "clubhouse", "cra",
];

const POSITION_LABELS: Record<BoardPositionName, string> = {
  president: "President",
  vp: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  pool: "Pool",
  membership: "Membership",
  tennis: "Tennis",
  social: "Social",
};

const COMMITTEE_LABELS: Record<ChairPositionName, string> = {
  web: "Web Committee",
  architecture: "Architecture Review",
  welcoming: "Welcoming Committee",
  clubhouse: "Clubhouse Committee",
  cra: "CRA Committee",
};

export default async function AgendaPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("role, name")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  const today = new Date().toISOString().split("T")[0];

  const { data: nextMeeting } = await supabase
    .from("meetings")
    .select("id, meeting_date, status, reminder_sent_at")
    .gte("meeting_date", today)
    .in("status", ["pending", "in_progress"])
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const meetingDate = nextMeeting?.meeting_date ?? getUpcomingMondays(1)[0];
  const hasMeeting = !!nextMeeting;

  const [positionsResult, updatesResult, lastMinutesResult] = await Promise.all([
    supabase.from("positions").select("id, name, email, role"),
    supabase
      .from("pre_meeting_updates")
      .select("position_id, content, submitted_at")
      .eq("meeting_date", meetingDate),
    supabase
      .from("meeting_minutes")
      .select("meeting_date, google_doc_url")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const allPositions = (positionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    email: string;
    role: string;
  }[];

  const boardPositions = allPositions.filter((p) =>
    (POSITION_ORDER as string[]).includes(p.name)
  );
  const committeePositions = allPositions.filter((p) =>
    (COMMITTEE_ORDER as string[]).includes(p.name)
  );

  const updatesByPositionId = new Map(
    (updatesResult.data ?? []).map((u) => [u.position_id, u])
  );

  const boardItems = POSITION_ORDER.map((posName) => {
    const pos = boardPositions.find((p) => p.name === posName);
    const update = pos ? updatesByPositionId.get(pos.id) : undefined;
    return { position: posName, label: POSITION_LABELS[posName], content: update?.content ?? null };
  });

  const committeeItems = COMMITTEE_ORDER.map((posName) => {
    const pos = committeePositions.find((p) => p.name === posName);
    const update = pos ? updatesByPositionId.get(pos.id) : undefined;
    return { position: posName, label: COMMITTEE_LABELS[posName], content: update?.content ?? null };
  });

  const totalPositions = POSITION_ORDER.length + COMMITTEE_ORDER.length;
  const submittedCount =
    boardItems.filter((i) => i.content !== null).length +
    committeeItems.filter((i) => i.content !== null).length;

  const missingBoardPositions = boardItems
    .filter((i) => i.content === null)
    .map((i) => i.position as PositionName);
  const missingChairPositions = committeeItems
    .filter((i) => i.content === null)
    .map((i) => i.position as PositionName);

  const isOfficerOrAbove = canEditAll(currentPosition.role);
  const lastMinutes = lastMinutesResult.data;

  let boardMailto: string | null = null;
  let chairMailto: string | null = null;
  let allMailto: string | null = null;

  if (isOfficerOrAbove) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const appUrl = `${proto}://${host}`;

    if (missingBoardPositions.length > 0) {
      boardMailto = buildReminderMailto({
        meetingDate,
        boardEmails: boardPositions.map((p) => p.email),
        missingPositions: missingBoardPositions,
        appUrl,
      });
    }

    if (missingChairPositions.length > 0) {
      chairMailto = buildReminderMailto({
        meetingDate,
        boardEmails: committeePositions.map((p) => p.email),
        missingPositions: missingChairPositions,
        appUrl,
        updateUrl: `${appUrl}/dashboard`,
      });
    }

    if (missingBoardPositions.length > 0 && missingChairPositions.length > 0) {
      allMailto = buildReminderMailto({
        meetingDate,
        boardEmails: allPositions.map((p) => p.email),
        missingPositions: [...missingBoardPositions, ...missingChairPositions],
        appUrl,
        updateUrl: `${appUrl}/dashboard`,
      });
    }
  }

  const showReminders =
    isOfficerOrAbove && (boardMailto || chairMailto || allMailto);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meeting Agenda"
        subtitle={
          hasMeeting
            ? formatMeetingDate(meetingDate)
            : `${formatMeetingDate(meetingDate)} — no meeting scheduled`
        }
      />

      {!hasMeeting && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No meeting has been scheduled yet. Showing the next Monday as a placeholder.
          {isOfficerOrAbove && (
            <>
              {" "}
              <Link href="/meetings/new" className="font-medium underline hover:no-underline">
                Schedule a meeting →
              </Link>
            </>
          )}
        </div>
      )}

      <SectionCard
        title="Agenda"
        description={`${submittedCount} of ${totalPositions} updates submitted`}
      >
        <ol className="space-y-5">
          <AgendaItem number={1} title="Call to Order" />

          <AgendaItem
            number={2}
            title="Approval of Prior Minutes"
            body={
              lastMinutes ? (
                <span className="text-sm text-muted-foreground">
                  {formatMeetingDate(lastMinutes.meeting_date)}
                  {lastMinutes.google_doc_url && (
                    <>
                      {" · "}
                      <a
                        href={lastMinutes.google_doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View minutes
                      </a>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No prior minutes on file.</span>
              )
            }
          />

          <li>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">3.</span>
              <span className="text-sm font-semibold text-foreground">Board Reports</span>
            </div>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {boardItems.map((item) => (
                <li key={item.position} className="py-3 pl-5">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.content === null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">— not submitted</span>
                    )}
                  </p>
                  {item.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                  )}
                </li>
              ))}
            </ul>
          </li>

          <li>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">4.</span>
              <span className="text-sm font-semibold text-foreground">Committee Reports</span>
            </div>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {committeeItems.map((item) => (
                <li key={item.position} className="py-3 pl-5">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.content === null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">— not submitted</span>
                    )}
                  </p>
                  {item.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                  )}
                </li>
              ))}
            </ul>
          </li>

          <AgendaItem number={5} title="New Business" />
          <AgendaItem number={6} title="Adjournment" />
        </ol>
      </SectionCard>

      {showReminders && (
        <SectionCard
          title="Send Reminder"
          description={`${missingBoardPositions.length + missingChairPositions.length} position${missingBoardPositions.length + missingChairPositions.length === 1 ? "" : "s"} have not submitted an update.`}
        >
          <ReminderSection
            meetingId={nextMeeting?.id ?? null}
            reminderSentAt={nextMeeting?.reminder_sent_at ?? null}
            boardMailto={boardMailto}
            chairMailto={chairMailto}
            allMailto={allMailto}
            meetingDate={meetingDate}
          />
        </SectionCard>
      )}
    </div>
  );
}

function AgendaItem({ number, title, body }: { number: number; title: string; body?: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">{number}.</span>
      <div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {body && <div className="mt-1">{body}</div>}
      </div>
    </li>
  );
}
```

- [ ] **Step 9.3: Type-check**

```bash
pnpm type-check
```

Expected: clean.

- [ ] **Step 9.4: Commit**

```bash
git add app/(dashboard)/agenda/
git commit -m "feat: add Committee Reports section and three reminder buttons to agenda"
```

---

## Task 10: Pre-meeting page — chair redirect and query filter

**Files:**
- Modify: `app/(dashboard)/pre-meeting/page.tsx`

- [ ] **Step 10.1: Add chair redirect and filter positions to voting members**

After `currentPosition` is fetched, add the chair redirect:

```ts
import { isChair, canEditAll } from "@/lib/permissions";
// ...
if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);
```

In the positions query, filter out chairs so their updates don't appear in the officer aggregate view:

```ts
// Find this query and add the role filter:
supabase
  .from("positions")
  .select("id, name, email")
  .in("role", ["president", "officer", "member"])
```

- [ ] **Step 10.2: Type-check**

```bash
pnpm type-check
```

Expected: clean.

- [ ] **Step 10.3: Commit**

```bash
git add app/(dashboard)/pre-meeting/page.tsx
git commit -m "feat: add chair redirect and voting-member filter to pre-meeting page"
```

---

## Task 11: Final verification

- [ ] **Step 11.1: Full type-check**

```bash
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 11.2: Full test suite**

```bash
pnpm test --ci
```

Expected: all tests pass (82 existing + new tests from Tasks 2, 3, 5).

- [ ] **Step 11.3: Manual smoke test — board member**

Log in as president. Verify:
- Sidebar shows "Committee Chairs" section with all 5 links
- "Architecture" link is gone from Primary Nav
- `/committee/architecture` loads the architecture requests list + pre-meeting form
- `/committee/web` loads with pre-meeting form only
- Agenda page shows "Committee Reports" section (item 4)
- Agenda shows "X of 13 updates submitted"
- "Remind Board", "Remind Chairs", and/or "Remind All" buttons appear when updates are missing
- Clicking a reminder button records the timestamp and shows the warning on next load

- [ ] **Step 11.4: Manual smoke test — chair**

Log in as any chair account. Verify:
- Sidebar shows only Dashboard + own section link
- `/dashboard` loads
- `/committee/[own name]` loads with pre-meeting form
- `/meetings` redirects to `/committee/[own name]`
- `/board/president` redirects to `/committee/[own name]`
- `/admin/settings` redirects to `/committee/[own name]`

- [ ] **Step 11.5: Run seed**

> **Manual step:** Run `pnpm seed` if you haven't already. This creates the 5 new auth accounts. Confirm the new chair accounts appear in the Supabase Auth dashboard.
