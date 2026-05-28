"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/actions/auth";
import type { Position } from "@/types/database";

/** Navigation item definition */
interface NavItem {
  label: string;
  href: string;
}

/** Top-level nav items visible to all board members */
const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Meetings", href: "/meetings" },
  { label: "Architecture", href: "/architecture" },
  { label: "CRA Projects", href: "/cra" },
  { label: "Pre-Meeting Update", href: "/pre-meeting" },
  { label: "Agenda", href: "/agenda" },
];

/** Position-specific board sections */
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

/** Admin nav — only shown to the president */
const ADMIN_NAV: NavItem[] = [
  { label: "Manage Positions", href: "/admin/positions" },
  { label: "Settings", href: "/admin/settings" },
];

interface SidebarProps {
  /** The current user's position data, used to highlight their section and show admin links */
  position: Position;
}

/**
 * Fixed left-side navigation for the authenticated dashboard layout.
 * Highlights the active route and shows admin links only to the president.
 */
export function Sidebar({ position }: SidebarProps) {
  const pathname = usePathname();

  /**
   * Returns true if the current pathname starts with the given href.
   * Uses exact match for the dashboard root to avoid highlighting it on all routes.
   */
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside className="flex h-full w-60 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 py-4">
      {/* HOA identity */}
      <div className="mb-4 px-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          HOA Board
        </p>
        <p className="mt-1 text-sm font-medium text-sidebar-foreground">
          Management Portal
        </p>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Primary navigation">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </ul>
      </nav>

      {/* Board section links */}
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

      {/* Admin section — president only */}
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

      {/* Spacer + session info at bottom */}
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
