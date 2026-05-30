# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-position/per-chair sidebar nav with a function-first nav (Dashboard, My Office, Meetings, Architecture, CRA Projects, Agenda, Amenities, Interactive Map, Admin), restore the missing `/architecture` dashboard page, and fix the `PreMeetingForm` date-change redirect bug exposed by the new routing.

**Architecture:** The `Sidebar` component receives the logged-in `position` and computes a single dynamic "My Office" link (`/board/[name]` for board members, `/committee/[name]` for chairs). The `/architecture` dashboard page is restored from the previously removed version — it shows all requests with status badges and gives the president an inline `VoteForm` on pending items. `PreMeetingForm` gets a `returnPath` prop so date changes navigate back to the caller's page instead of hardcoding `/pre-meeting`. Placeholder pages for Amenities and Interactive Map follow the existing Server Component + `PageHeader` + `EmptyState` pattern.

**Tech Stack:** Next.js 16 App Router (Server Components), React, TypeScript, Tailwind CSS v4, shadcn/ui v4, Jest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `components/hoa/PreMeetingForm.tsx` | Add `returnPath` prop; push to returnPath on date change |
| Modify | `components/hoa/PreMeetingForm.test.tsx` | Test returnPath navigation behavior |
| Modify | `app/(dashboard)/board/[position]/page.tsx` | Pass `returnPath`, read `searchParams.date` |
| Modify | `app/(dashboard)/committee/[chair]/page.tsx` | Pass `returnPath`, read `searchParams.date` |
| Modify | `components/hoa/Sidebar.tsx` | New nav structure |
| Modify | `components/hoa/Sidebar.test.tsx` | Replace tests for new structure |
| Create | `app/(dashboard)/architecture/page.tsx` | Restore architecture requests list + president VoteForm |
| Create | `app/(dashboard)/amenities/page.tsx` | Placeholder — Pool, Clubhouse, Tennis |
| Create | `app/(dashboard)/map/page.tsx` | Placeholder — Interactive Map |

`app/(dashboard)/layout.tsx` — no changes needed.

---

## Task 1: Fix PreMeetingForm date-change navigation

**The bug:** `PreMeetingForm` hardcodes `router.push('/pre-meeting?date=...')` when the user selects a different date. The `/pre-meeting` page redirects members to `/board/[position]` and redirects chairs to `/committee/[chair]` — stripping the `?date` param in the process. The date picker silently does nothing for anyone who isn't an officer or president.

**The fix:** Add a `returnPath` prop. Callers pass their own route. The form pushes `${returnPath}?date=${date}`. Each caller page reads `searchParams.date` and passes it as `selectedDate` so the selected date survives the navigation.

**Files:**
- Modify: `components/hoa/PreMeetingForm.tsx`
- Modify: `components/hoa/PreMeetingForm.test.tsx`
- Modify: `app/(dashboard)/board/[position]/page.tsx`
- Modify: `app/(dashboard)/committee/[chair]/page.tsx`

- [ ] **Step 1: Write the failing test**

The existing `PreMeetingForm.test.tsx` mocks `useRouter` as a factory (`useRouter: () => ({ push: jest.fn() })`), which creates a fresh `jest.fn()` on each render — you can't capture it to assert on calls. Replace the mock at the top of the file and add the import so we can assert on `push`.

**At the top of `components/hoa/PreMeetingForm.test.tsx`**, replace:
```tsx
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
```
with:
```tsx
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
```

Then add this describe block inside the existing `describe("PreMeetingForm")` block, after the existing describe groups:

```tsx
describe("date selector navigation", () => {
  it("pushes to returnPath with date when a different date is selected", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });

    render(
      <PreMeetingForm
        positionId="pos-1"
        selectedDate="2026-06-02"
        upcomingMondays={["2026-06-02", "2026-06-09", "2026-06-16"]}
        returnPath="/board/pool"
      />
    );

    // formatMeetingDate is mocked to return "Meeting: <date>"
    const dateButton = screen.getByRole("button", { name: "Meeting: 2026-06-09" });
    await userEvent.click(dateButton);

    expect(push).toHaveBeenCalledWith("/board/pool?date=2026-06-09");
  });

  it("defaults returnPath to /pre-meeting when not provided", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });

    render(
      <PreMeetingForm
        positionId="pos-1"
        selectedDate="2026-06-02"
        upcomingMondays={["2026-06-02", "2026-06-09"]}
      />
    );

    const dateButton = screen.getByRole("button", { name: "Meeting: 2026-06-09" });
    await userEvent.click(dateButton);

    expect(push).toHaveBeenCalledWith("/pre-meeting?date=2026-06-09");
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
pnpm test components/hoa/PreMeetingForm.test.tsx
```

Expected: the two new tests FAIL (property `returnPath` does not exist on type).

- [ ] **Step 3: Add `returnPath` prop to `PreMeetingForm`**

Open `components/hoa/PreMeetingForm.tsx`. Find the props interface and the `router.push` call:

In the interface, add:
```tsx
/** Route to navigate to on date change. Defaults to /pre-meeting (for officers/president). */
returnPath?: string;
```

Find the `router.push` call (currently `router.push(\`/pre-meeting?date=${date}\`)`) and replace it:
```tsx
router.push(`${returnPath ?? "/pre-meeting"}?date=${date}`);
```

- [ ] **Step 4: Run the tests — expect all to pass**

```bash
pnpm test components/hoa/PreMeetingForm.test.tsx
```

Expected: all tests PASS including the two new ones.

- [ ] **Step 5: Update `board/[position]/page.tsx` to pass `returnPath` and read `searchParams.date`**

The page currently ignores `searchParams`. Add it so the selected date survives navigation.

Find the `Props` interface at the top of the file and replace it:
```tsx
interface Props {
  params: Promise<{ position: string }>;
  searchParams: Promise<{ date?: string }>;
}
```

Update the function signature:
```tsx
export default async function BoardPositionPage({ params, searchParams }: Props) {
  const { position } = await params;
  const { date: dateParam } = await searchParams;
  // ... rest of existing code
```

Find where `nextMeetingDate` is computed (currently `const nextMeetingDate = meetingDates[0]`) and replace it with:
```tsx
const nextMeetingDate = (dateParam && meetingDates.includes(dateParam))
  ? dateParam
  : meetingDates[0];
```

Find the `<PreMeetingForm>` usage and add the `returnPath` prop:
```tsx
<PreMeetingForm
  positionId={currentPosition.id}
  selectedDate={nextMeetingDate}
  upcomingMondays={meetingDates}
  existingContent={existingUpdate?.content ?? undefined}
  returnPath={`/board/${position}`}
/>
```

- [ ] **Step 6: Update `committee/[chair]/page.tsx` to pass `returnPath` and read `searchParams.date`**

Same pattern as the board page. Find the `Props` interface and replace:
```tsx
interface Props {
  params: Promise<{ chair: string }>;
  searchParams: Promise<{ date?: string }>;
}
```

Update the function signature:
```tsx
export default async function CommitteePage({ params, searchParams }: Props) {
  const { chair } = await params;
  const { date: dateParam } = await searchParams;
  // ... rest of existing code
```

Find where `nextMeetingDate` is computed and replace:
```tsx
const nextMeetingDate = (dateParam && meetingDates.includes(dateParam))
  ? dateParam
  : meetingDates[0];
```

Find the `<PreMeetingForm>` usage (appears twice — once in `canEdit` branch, once in read-only branch that doesn't render a form) and add `returnPath`:
```tsx
<PreMeetingForm
  positionId={targetPosition.id}
  selectedDate={nextMeetingDate}
  upcomingMondays={meetingDates}
  existingContent={existingUpdate?.content ?? undefined}
  returnPath={`/committee/${chair}`}
/>
```

- [ ] **Step 7: Run type check and full test suite**

```bash
pnpm type-check && pnpm test
```

Expected: no type errors, all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add components/hoa/PreMeetingForm.tsx components/hoa/PreMeetingForm.test.tsx \
  app/\(dashboard\)/board/\[position\]/page.tsx \
  app/\(dashboard\)/committee/\[chair\]/page.tsx
git commit -m "fix: PreMeetingForm returnPath prop — date selection no longer strips to /pre-meeting"
```

---

## Task 2: Update Sidebar tests

**Files:**
- Modify: `components/hoa/Sidebar.test.tsx`

The existing tests assert the old structure. Replace them entirely. Run them first to confirm they fail before touching the component.

- [ ] **Step 1: Replace the test file**

```tsx
import { render, screen, within } from "@testing-library/react";
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
  it("shows My Office link pointing to /board/[name] for a member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute("href", "/board/pool");
  });

  it("shows My Office link pointing to /board/president for president", () => {
    render(<Sidebar position={makePosition({ name: "president", role: "president" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute("href", "/board/president");
  });

  it("shows all function nav items", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CRA Projects" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amenities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interactive Map" })).toBeInTheDocument();
  });

  it("does not show Board Sections group or individual position links", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByText("Board Sections")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Secretary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pool" })).not.toBeInTheDocument();
  });

  it("does not show Committee Chairs group or individual chair links", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByText("Committee Chairs")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Web Committee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Architecture Review" })).not.toBeInTheDocument();
  });

  it("does not show Pre-Meeting Update link", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.queryByRole("link", { name: "Pre-Meeting Update" })).not.toBeInTheDocument();
  });

  it("shows Admin section only for president", () => {
    render(<Sidebar position={makePosition({ role: "president" })} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage Positions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides Admin section for officer", () => {
    render(<Sidebar position={makePosition({ name: "vp", role: "officer" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("hides Admin section for member", () => {
    render(<Sidebar position={makePosition({ name: "pool", role: "member" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});

describe("Sidebar — chair view", () => {
  it("shows only Dashboard and My Office in the primary nav", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(primaryNav).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Dashboard");
    expect(links[1]).toHaveTextContent("My Office");
  });

  it("My Office link points to /committee/[name] for chairs", () => {
    render(<Sidebar position={makePosition({ name: "architecture", role: "chair" })} />);
    expect(screen.getByRole("link", { name: "My Office" })).toHaveAttribute(
      "href",
      "/committee/architecture"
    );
  });

  it("hides function nav items from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByRole("link", { name: "Meetings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Amenities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Interactive Map" })).not.toBeInTheDocument();
  });

  it("hides Admin section from chairs", () => {
    render(<Sidebar position={makePosition({ name: "web", role: "chair" })} />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
pnpm test components/hoa/Sidebar.test.tsx
```

Expected: most tests FAIL (old structure still in place). If any new test unexpectedly passes, investigate before continuing.

---

## Task 3: Rewrite the Sidebar component

**Files:**
- Modify: `components/hoa/Sidebar.tsx`

- [ ] **Step 1: Replace the component**

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

const FUNCTION_NAV: NavItem[] = [
  { label: "Meetings", href: "/meetings" },
  { label: "Architecture", href: "/architecture" },
  { label: "CRA Projects", href: "/cra" },
  { label: "Agenda", href: "/agenda" },
  { label: "Amenities", href: "/amenities" },
  { label: "Interactive Map", href: "/map" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Manage Positions", href: "/admin/positions" },
  { label: "Settings", href: "/admin/settings" },
];

interface SidebarProps {
  /** The current user's position, used to build the My Office link and gate Admin links. */
  position: Position;
}

/**
 * Fixed left-side navigation for the authenticated dashboard layout.
 * Chairs see Dashboard and My Office only.
 * Board members see Dashboard, My Office, all function pages, and (president only) Admin.
 */
export function Sidebar({ position }: SidebarProps) {
  const pathname = usePathname();

  const myOfficeHref = isChair(position.role)
    ? `/committee/${position.name}`
    : `/board/${position.name}`;

  /** Exact match for /dashboard prevents it staying active on every sub-route. */
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const displayName = position.name === "vp" ? "Vice President" : position.name;

  if (isChair(position.role)) {
    return (
      <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
        <SidebarBrand />
        <nav aria-label="Primary navigation">
          <ul className="space-y-0.5">
            <SidebarLink item={{ label: "Dashboard", href: "/dashboard" }} active={isActive("/dashboard")} />
            <SidebarLink item={{ label: "My Office", href: myOfficeHref }} active={isActive(myOfficeHref)} />
          </ul>
        </nav>
        <SidebarFooter displayName={displayName} />
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <SidebarBrand />

      <nav aria-label="Primary navigation">
        <ul className="space-y-0.5">
          <SidebarLink item={{ label: "Dashboard", href: "/dashboard" }} active={isActive("/dashboard")} />
          <SidebarLink item={{ label: "My Office", href: myOfficeHref }} active={isActive(myOfficeHref)} />
        </ul>
      </nav>

      <nav aria-label="Function navigation" className="mt-4">
        <ul className="space-y-0.5">
          {FUNCTION_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </ul>
      </nav>

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

      <SidebarFooter displayName={displayName} />
    </aside>
  );
}

/** HOA identity lockup at the top of the sidebar. */
function SidebarBrand() {
  return (
    <div className="mb-4 px-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
        HOA Board
      </p>
      <p className="mt-1 text-sm font-medium text-sidebar-foreground">
        Management Portal
      </p>
    </div>
  );
}

/** Sign-out section pinned to the bottom of the sidebar. */
function SidebarFooter({ displayName }: { displayName: string }) {
  return (
    <div className="mt-auto pt-4 border-t border-sidebar-border">
      <div className="mb-2 px-2">
        <p className="text-xs text-sidebar-foreground/60">Signed in as</p>
        <p className="text-sm font-medium capitalize text-sidebar-foreground">
          {displayName}
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
  );
}

/** Individual sidebar navigation link with active styling. */
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

- [ ] **Step 2: Run Sidebar tests — expect all to pass**

```bash
pnpm test components/hoa/Sidebar.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test && pnpm type-check
```

Expected: all tests PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/hoa/Sidebar.tsx components/hoa/Sidebar.test.tsx
git commit -m "feat: restructure sidebar nav — function-first, remove per-position links"
```

---

## Task 4: Restore the Architecture dashboard page

**Context:** `app/(dashboard)/architecture/page.tsx` was removed in a recent commit (moved to the committee chair page). The new "Architecture" sidebar link points to `/architecture`, which currently 404s for all board members. This restores it as a shared board resource: all members see the full request list; the president gets an inline `VoteForm` on pending items.

**Files:**
- Create: `app/(dashboard)/architecture/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { EmptyState } from "@/components/hoa/EmptyState";
import { VoteForm } from "@/components/hoa/VoteForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ArchitectureRequest } from "@/types/database";

export const metadata = {
  title: "Architecture — HOA Board",
};

/**
 * Board-wide architecture requests page.
 * All board members see the full request list with status badges.
 * The president additionally sees an inline VoteForm on each pending item.
 * "Submit New Request" is stubbed — see docs/specs/architecture-upload.md.
 * Chairs are redirected to their committee page (consistent with all other dashboard pages).
 */
export default async function ArchitecturePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [positionResult, requestsResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase
      .from("architecture_requests")
      .select("id, address, description, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const position = positionResult.data;
  if (!position) redirect("/login");
  if (isChair(position.role)) redirect(`/committee/${position.name}`);

  const requests = (requestsResult.data ?? []) as Pick<
    ArchitectureRequest,
    "id" | "address" | "description" | "status" | "created_at"
  >[];

  const isPresident = position.role === "president";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Architecture Requests"
        subtitle="Homeowner architecture and modification requests"
        action={
          <Button size="sm" disabled>
            Submit New Request
          </Button>
        }
      />

      <SectionCard
        title={`${requests.length} request${requests.length === 1 ? "" : "s"}`}
      >
        {requests.length === 0 ? (
          <EmptyState title="No architecture requests on file." />
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((req) => (
              <li key={req.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{req.address}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {req.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
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
                </div>
                {isPresident && req.status === "pending" && (
                  <div className="mt-3">
                    <VoteForm requestId={req.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Start the dev server (`pnpm dev`). Log in as a board member and click "Architecture" in the sidebar. Expected: the requests list renders and the "Architecture" nav item is highlighted.

Log in as president. Expected: pending requests show an inline `VoteForm`.

- [ ] **Step 3: Run type check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/architecture/page.tsx
git commit -m "feat: restore architecture dashboard page with president vote form"
```

---

## Task 5: Create Amenities placeholder page

**Files:**
- Create: `app/(dashboard)/amenities/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = {
  title: "Amenities — HOA Board",
};

/**
 * Amenities page. Will show Pool, Clubhouse, and Tennis widgets.
 * Placeholder pending amenity-specific feature specs.
 */
export default function AmenitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Amenities"
        subtitle="Pool, Clubhouse, and Tennis"
      />
      <EmptyState
        title="Coming soon"
        description="Amenity management tools are being built."
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Navigate to `/amenities`. Expected: page loads with the empty state and the Amenities nav item is highlighted.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/amenities/page.tsx
git commit -m "feat: add Amenities placeholder page"
```

---

## Task 6: Create Interactive Map placeholder page

**Files:**
- Create: `app/(dashboard)/map/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = {
  title: "Interactive Map — HOA Board",
};

/**
 * Interactive neighborhood map page.
 * Will display an SVG map (stored in DB) with clickable lot polygons and a property data table.
 * Placeholder pending the map feature spec and property/resident data migration.
 */
export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Map"
        subtitle="Neighborhood lots and property information"
      />
      <EmptyState
        title="Coming soon"
        description="The interactive neighborhood map is in development."
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Navigate to `/map`. Expected: page loads with the empty state and the Interactive Map nav item is highlighted.

- [ ] **Step 3: Run full test suite and type check one final time**

```bash
pnpm test && pnpm type-check
```

Expected: all tests PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/map/page.tsx
git commit -m "feat: add Interactive Map placeholder page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Remove Board Sections (8 position links) → Task 3
- ✅ Remove Committee Chairs (5 chair links) → Task 3
- ✅ Remove Pre-Meeting Update from sidebar → Task 3
- ✅ My Office link: `/board/[name]` for board members → Task 3
- ✅ My Office link: `/committee/[name]` for chairs → Task 3
- ✅ Chairs see Dashboard + My Office only → Task 3
- ✅ Function nav: Meetings, Architecture, CRA Projects, Agenda, Amenities, Interactive Map → Task 3
- ✅ Admin section president-only → Task 3
- ✅ `/architecture` nav link resolves to a real page → Task 4
- ✅ President VoteForm on architecture page → Task 4
- ✅ Amenities placeholder → Task 5
- ✅ Interactive Map placeholder → Task 6
- ✅ PreMeetingForm redirect bug fixed → Task 1
- ✅ Chair test scoped to `aria-label="Primary navigation"` — not `links.length` → Task 2

**Known issues deferred to subsequent specs:**
- `/pre-meeting` page still exists and is accessible via direct URL — it will be removed when the dashboard widget spec folds its content into the dashboard
- Browsing to another board member's page (e.g., president visiting `/board/secretary`) leaves no sidebar item active — accepted behavior, not a bug
- The architecture chair's committee page (`/committee/architecture`) still shows a PreMeetingForm + architecture list — the committee page spec will decide how this evolves
