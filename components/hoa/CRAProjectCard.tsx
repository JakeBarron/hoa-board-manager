import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { formatCents } from "@/lib/money";
import { quoteReadiness } from "@/lib/cra/projects";
import type { CRAProject } from "@/types/database";

interface CRAProjectCardProps {
  /** The project to render */
  project: CRAProject;
  /** Number of quotes attached, for the X-of-3 readiness pill */
  quoteCount: number;
}

/** Formats an ISO date (YYYY-MM-DD) as a short human date, or "" if null. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Clickable summary card for a CRA project in the list view.
 * Shows name, status, category, priority, estimated (and actual) cost,
 * target date with an overdue cue, and 3-quote readiness.
 *
 * @param project    - The project to display
 * @param quoteCount - Attached quote count for the readiness indicator
 */
export function CRAProjectCard({ project, quoteCount }: CRAProjectCardProps) {
  const readiness = quoteReadiness(quoteCount);
  const overdue =
    project.target_date !== null &&
    project.status !== "complete" &&
    project.target_date < new Date().toISOString().slice(0, 10);

  return (
    <Link href={`/cra/${project.id}`} className="block">
      <Card className="p-4 transition-colors hover:bg-accent/40">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium">{project.name}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {project.category && (
                <span className="rounded bg-muted px-1.5 py-0.5">{project.category}</span>
              )}
              {project.priority && (
                <span className="capitalize">{project.priority} priority</span>
              )}
              {project.target_date && (
                <span className={overdue ? "text-destructive font-medium" : ""}>
                  Due {shortDate(project.target_date)}{overdue ? " · overdue" : ""}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="space-x-1">
            <span>Est.</span>
            <span>{formatCents(project.estimated_cost ?? 0)}</span>
            {project.actual_cost !== null && (
              <span className="text-muted-foreground">
                · Actual {formatCents(project.actual_cost)}
              </span>
            )}
          </div>
          <span className={readiness.met ? "text-green-600" : "text-amber-600"}>
            {readiness.count} of {readiness.required} quotes
          </span>
        </div>
      </Card>
    </Link>
  );
}
