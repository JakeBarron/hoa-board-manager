"use client";

import { useState, useMemo } from "react";
import { CRAProjectCard } from "@/components/hoa/CRAProjectCard";
import { compareProjects, isOpenStatus, sumEstimated, sumActual } from "@/lib/cra/projects";
import { formatCents } from "@/lib/money";
import { EmptyState } from "@/components/hoa/EmptyState";
import type { CRAProject, CRAQuote, CRAUpdate, CRADocument } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectListProps {
  projects: CRAProject[];
  quotesByProject: Record<string, CRAQuote[]>;
  updatesByProject: Record<string, (CRAUpdate & { positions: { name: string } | null })[]>;
  documentsByProject: Record<string, CRADocument[]>;
  fiscalYears: FiscalYearOption[];
  canEdit: boolean;
  positionId: string;
  initialExpandedId: string | null;
}

/**
 * Client list for /cra: Open/Complete tabs, fiscal-year filter, and a totals
 * summary bar. Cards expand inline to show full project detail. Sorting and
 * totals use the pure helpers from lib/cra/projects.
 *
 * @param projects           - All CRA projects (any fiscal year)
 * @param quotesByProject    - Map of project id → attached quotes (ordered by created_at)
 * @param updatesByProject   - Map of project id → updates with author name (newest first)
 * @param documentsByProject - Map of project id → documents (ordered by created_at)
 * @param fiscalYears        - Options for the fiscal-year filter (most-recent first)
 * @param canEdit            - Whether the current user may edit CRA data
 * @param positionId         - Current user's position id (passed to CRADocumentsSection)
 * @param initialExpandedId  - Project id to open on first render (from ?expand= searchParam)
 */
export function CRAProjectList({
  projects,
  quotesByProject,
  updatesByProject,
  documentsByProject,
  fiscalYears,
  canEdit,
  positionId,
  initialExpandedId,
}: CRAProjectListProps) {
  const [tab, setTab] = useState<"open" | "complete">("open");
  const [fyId, setFyId] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialExpandedId ? [initialExpandedId] : [])
  );

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visible = useMemo(() => {
    return projects
      .filter((p) => (tab === "open" ? isOpenStatus(p.status) : p.status === "complete"))
      .filter((p) => (fyId === "all" ? true : p.fiscal_year_id === fyId))
      .sort(compareProjects);
  }, [projects, tab, fyId]);

  const estTotal = sumEstimated(visible);
  const actTotal = sumActual(visible);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(["open", "complete"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                tab === t ? "bg-accent font-medium" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <select
          value={fyId}
          onChange={(e) => setFyId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by fiscal year"
        >
          <option value="all">All fiscal years</option>
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>{fy.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
        {visible.length} project{visible.length === 1 ? "" : "s"} ·{" "}
        <span className="font-medium">{formatCents(estTotal)}</span> budgeted
        {actTotal > 0 && <> · <span className="font-medium">{formatCents(actTotal)}</span> spent</>}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No projects here"
          description={tab === "open" ? "No open projects for this filter." : "No completed projects yet."}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <CRAProjectCard
              key={p.id}
              project={p}
              quotes={quotesByProject[p.id] ?? []}
              updates={updatesByProject[p.id] ?? []}
              documents={documentsByProject[p.id] ?? []}
              fiscalYears={fiscalYears}
              canEdit={canEdit}
              positionId={positionId}
              expanded={expandedIds.has(p.id)}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
