"use client";

import { useMemo, useState } from "react";
import {
  groupByMonth,
  monthName,
  formatItemDate,
  type CalendarItem,
} from "@/lib/calendar/calendar";
import { EmptyState } from "./EmptyState";

interface CalendarViewProps {
  /** All calendar items for the current year, pre-built by the page. */
  items: CalendarItem[];
}

/**
 * Returns distinct area descriptors present in the given items, sorted by name.
 *
 * @param items - Flat calendar items
 * @returns Unique areas sorted alphabetically by name
 */
function areaLegend(items: CalendarItem[]) {
  const seen = new Map<string, { id: string; name: string; color: string }>();
  for (const it of items) {
    if (!seen.has(it.areaId))
      seen.set(it.areaId, { id: it.areaId, name: it.areaName, color: it.areaColor });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read-only operating calendar: a color-coded legend of responsibility areas
 * (click to filter) over month-grouped event sections (Jan→Dec).
 *
 * @param items - Flat calendar items for the current year
 */
export function CalendarView({ items }: CalendarViewProps) {
  const legend = useMemo(() => areaLegend(items), [items]);
  const [activeArea, setActiveArea] = useState<string | null>(null);

  const visible = useMemo(
    () => (activeArea ? items.filter((i) => i.areaId === activeArea) : items),
    [items, activeArea]
  );
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filter by area" className="flex flex-wrap gap-2">
        {legend.map((a) => {
          const active = activeArea === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveArea(active ? null : a.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                active ? "border-foreground" : "border-border hover:bg-muted"
              }`}
              aria-pressed={active}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: a.color }}
              />
              {a.name}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No calendar events yet" />
      ) : (
        groups.map((group) => (
          <section key={group.month} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthName(group.month)}
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border">
              {group.items.map((it) => (
                <li key={it.occurrenceId} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.areaColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{it.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatItemDate(it)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.areaName}
                      {it.responsibleParty ? ` · ${it.responsibleParty}` : ""}
                    </div>
                    {it.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>
                    ) : null}
                    {it.templateUrl ? (
                      <a
                        href={it.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        Template
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
