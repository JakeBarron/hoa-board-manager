import type { CRAProject, CRAProjectStatus, CRAPriority } from "@/types/database";

/** Statuses shown on the "Open" tab and counted as active on the dashboard. */
export const OPEN_STATUSES: CRAProjectStatus[] = [
  "proposed",
  "approved",
  "in_progress",
  "on_hold",
];

/** Number of quotes the HOA bylaws require per project. */
export const REQUIRED_QUOTES = 3 as const;

/**
 * Returns true if the status belongs to the Open tab (everything except complete).
 * @param status - A CRA project status
 */
export function isOpenStatus(status: CRAProjectStatus): boolean {
  return status !== "complete";
}

const PRIORITY_RANK: Record<CRAPriority, number> = { high: 0, medium: 1, low: 2 };

/** Rank for sorting; null priority sorts after all explicit priorities. */
function priorityRank(p: CRAPriority | null): number {
  return p === null ? 3 : PRIORITY_RANK[p];
}

/**
 * Default list comparator for the Open tab: priority high→low (null last),
 * then on_hold sinks below other open statuses, then target_date ascending
 * (null last). Pure — pass directly to Array.prototype.sort.
 *
 * @param a - First project
 * @param b - Second project
 */
export function compareProjects(a: CRAProject, b: CRAProject): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;

  const aHold = a.status === "on_hold" ? 1 : 0;
  const bHold = b.status === "on_hold" ? 1 : 0;
  if (aHold !== bHold) return aHold - bHold;

  const aDate = a.target_date ?? "9999-12-31";
  const bDate = b.target_date ?? "9999-12-31";
  return aDate.localeCompare(bDate);
}

/**
 * Computes quote readiness against the 3-quote requirement.
 * @param count - Number of quotes attached to the project
 */
export function quoteReadiness(count: number): {
  count: number;
  required: typeof REQUIRED_QUOTES;
  met: boolean;
} {
  return { count, required: REQUIRED_QUOTES, met: count >= REQUIRED_QUOTES };
}

/** Sums estimated_cost (cents) across projects, treating null as 0. */
export function sumEstimated(projects: Pick<CRAProject, "estimated_cost">[]): number {
  return projects.reduce((s, p) => s + (p.estimated_cost ?? 0), 0);
}

/** Sums actual_cost (cents) across projects, treating null as 0. */
export function sumActual(projects: Pick<CRAProject, "actual_cost">[]): number {
  return projects.reduce((s, p) => s + (p.actual_cost ?? 0), 0);
}
