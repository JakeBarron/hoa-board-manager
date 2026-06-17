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
  { label: "Annual Cycle", href: "/calendar" },
  { label: "Architecture", href: "/architecture" },
  { label: "Documents", href: "/documents" },
  { label: "Directory", href: "/directory" },
  { label: "CRA Projects", href: "/cra" },
  { label: "Treasury", href: "/treasury" },
  { label: "Amenities", href: "/amenities" },
  { label: "Properties", href: "/properties" },
  { label: "Map", href: "/map" },
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
            <SidebarLink item={{ label: "Home", href: "/dashboard" }} active={isActive("/dashboard")} />
            <SidebarLink item={{ label: "My Office", href: myOfficeHref }} active={isActive(myOfficeHref)} />
            {/* Treasury is read-only for chairs — the page hides edit controls behind canEditTreasury */}
            <SidebarLink item={{ label: "Treasury", href: "/treasury" }} active={isActive("/treasury")} />
            <SidebarLink item={{ label: "Annual Cycle", href: "/calendar" }} active={isActive("/calendar")} />
            <SidebarLink item={{ label: "Directory", href: "/directory" }} active={isActive("/directory")} />
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
          <SidebarLink item={{ label: "Home", href: "/dashboard" }} active={isActive("/dashboard")} />
          <SidebarLink item={{ label: "My Office", href: myOfficeHref }} active={isActive(myOfficeHref)} />
        </ul>
      </nav>

      <nav aria-label="Function navigation">
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
