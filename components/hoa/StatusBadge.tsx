"use client";

import { cn } from "@/lib/utils";

/**
 * All possible status values used across the app.
 * Architecture requests use: pending | approved | denied
 * CRA projects use: proposed | approved | in_progress | complete | on_hold
 */
export type AppStatus =
  | "pending"
  | "approved"
  | "denied"
  | "proposed"
  | "in_progress"
  | "complete"
  | "on_hold";

/** Maps each status to a Tailwind color class pair (background + text). */
const STATUS_STYLES: Record<AppStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  proposed: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  complete: "bg-emerald-100 text-emerald-800 border-emerald-200",
  on_hold: "bg-orange-100 text-orange-800 border-orange-200",
};

/** Human-readable labels for each status value. */
const STATUS_LABELS: Record<AppStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  proposed: "Proposed",
  in_progress: "In Progress",
  complete: "Complete",
  on_hold: "On Hold",
};

interface StatusBadgeProps {
  status: AppStatus;
  className?: string;
}

/**
 * Renders a colored pill badge for any application status value.
 * Colors are semantic: yellow = pending, green = approved/complete, red = denied, etc.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Curried helper — returns a StatusBadge element for a given status.
 * Useful in table renderers and list items where you need a factory function.
 *
 * @example
 * const renderStatus = statusBadgeFor("approved");
 * // later: {renderStatus()}
 */
export const statusBadgeFor = (status: AppStatus) => () => (
  <StatusBadge status={status} />
);
