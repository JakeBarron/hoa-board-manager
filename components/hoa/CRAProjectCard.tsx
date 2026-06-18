"use client";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CRAProjectHeader } from "@/components/hoa/CRAProjectHeader";
import { CRAQuotesSection } from "@/components/hoa/CRAQuotesSection";
import { CRAUpdatesSection } from "@/components/hoa/CRAUpdatesSection";
import { CRADocumentsSection } from "@/components/hoa/CRADocumentsSection";
import { formatCents } from "@/lib/money";
import { quoteReadiness } from "@/lib/cra/projects";
import type { CRAProject, CRAQuote, CRAUpdate, CRADocument } from "@/types/database";

interface CRAProjectCardProps {
  /** The project to render */
  project: CRAProject;
  /** All quotes attached to this project */
  quotes: CRAQuote[];
  /** All updates attached to this project, with author name, newest first */
  updates: (CRAUpdate & { positions: { name: string } | null })[];
  /** All documents attached to this project */
  documents: CRADocument[];
  /** Fiscal year options (passed to CRAProjectHeader) */
  fiscalYears: { id: string; label: string }[];
  /** Whether the current user may edit CRA data */
  canEdit: boolean;
  /** Current user's position id (passed to CRADocumentsSection) */
  positionId: string;
  /** Whether this card's detail panel is currently open */
  expanded: boolean;
  /** Called when the user clicks the summary row to toggle expansion */
  onToggle: () => void;
}

/** Formats an ISO date (YYYY-MM-DD) as a short human date, or "" if null. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Expandable summary card for a CRA project in the list view.
 * Clicking the summary row toggles an inline detail panel containing the
 * project header, quotes, updates, and documents — no separate page needed.
 *
 * Shows name, status, category, priority, estimated (and actual) cost,
 * target date with an overdue cue, and 3-quote readiness in the summary row.
 *
 * @param project    - The project to display
 * @param quotes     - Attached quotes (for readiness count)
 * @param updates    - Attached status updates with author name
 * @param documents  - Attached documents
 * @param fiscalYears - Fiscal year options (passed to header edit form)
 * @param canEdit    - Whether the current user may edit
 * @param positionId - Current user's position id
 * @param expanded   - Whether the detail panel is visible
 * @param onToggle   - Callback to open/close the panel
 */
export function CRAProjectCard({
  project,
  quotes,
  updates,
  documents,
  fiscalYears,
  canEdit,
  positionId,
  expanded,
  onToggle,
}: CRAProjectCardProps) {
  const readiness = quoteReadiness(quotes.length);
  const overdue =
    project.target_date !== null &&
    project.status !== "complete" &&
    project.target_date < new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left p-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{project.name}</p>
            <span className="text-muted-foreground text-sm">
              {expanded ? "▾" : "▸"}
            </span>
          </div>
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

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={project.status} />
          <div className="flex items-center gap-3 text-sm">
            <span>
              Est. {formatCents(project.estimated_cost ?? 0)}
              {project.actual_cost !== null && (
                <span className="text-muted-foreground ml-1">
                  · Actual {formatCents(project.actual_cost)}
                </span>
              )}
            </span>
            <span className={readiness.met ? "text-green-600" : "text-amber-600"}>
              {readiness.count} of {readiness.required} quotes
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-6 border-t border-border p-4">
          <CRAProjectHeader project={project} fiscalYears={fiscalYears} canEdit={canEdit} />
          <SectionCard title="Quotes">
            <CRAQuotesSection projectId={project.id} quotes={quotes} canEdit={canEdit} />
          </SectionCard>
          <SectionCard title="Status updates">
            <CRAUpdatesSection projectId={project.id} updates={updates} canEdit={canEdit} />
          </SectionCard>
          <SectionCard title="Documents">
            <CRADocumentsSection
              projectId={project.id}
              documents={documents}
              positionId={positionId}
              canEdit={canEdit}
            />
          </SectionCard>
        </div>
      )}
    </Card>
  );
}
