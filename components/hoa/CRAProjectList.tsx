"use client";

import { useState, useMemo } from "react";
import { CRAProjectCard } from "@/components/hoa/CRAProjectCard";
import { compareProjects, isOpenStatus, sumEstimated, sumActual } from "@/lib/cra/projects";
import { formatCents } from "@/lib/money";
import { EmptyState } from "@/components/hoa/EmptyState";
import type { CRAProject } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectListProps {
  projects: CRAProject[];
  quoteCounts: Record<string, number>;
  fiscalYears: FiscalYearOption[];
}

/**
 * Client list for /cra: Open/Complete tabs, fiscal-year filter, and a totals
 * summary bar. Sorting and totals use the pure helpers from lib/cra/projects.
 *
 * @param projects    - All CRA projects (any fiscal year)
 * @param quoteCounts - Map of project id → attached quote count
 * @param fiscalYears - Options for the fiscal-year filter (most-recent first)
 */
export function CRAProjectList({ projects, quoteCounts, fiscalYears }: CRAProjectListProps) {
  const [tab, setTab] = useState<"open" | "complete">("open");
  const [fyId, setFyId] = useState<string>("all");

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
            <CRAProjectCard key={p.id} project={p} quoteCount={quoteCounts[p.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
