"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveArea,
  deleteArea,
  saveEvent,
  deleteEvent,
  type EventInput,
} from "@/actions/calendar";
import { monthName } from "@/lib/calendar/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "./SectionCard";
import { InlineConfirm } from "./InlineConfirm";
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

interface CalendarAdminProps {
  areas: ResponsibilityArea[];
  events: CalendarEvent[];
  occurrences: EventOccurrence[];
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Empty draft for a new event. */
function emptyEvent(areaId: string): EventInput {
  return {
    areaId,
    title: "",
    responsibleParty: null,
    notes: null,
    templateUrl: null,
    occurrences: [],
  };
}

/**
 * Inline delete button that expands to an InlineConfirm strip on click.
 * Wraps InlineConfirm (which requires message + onConfirm + onDismiss) in a
 * two-state toggle so callers only provide an action and a label.
 *
 * @param label     - Button label shown before confirmation is requested
 * @param message   - Confirmation prompt shown in the InlineConfirm strip
 * @param disabled  - Disables the trigger button while a transition is pending
 * @param onConfirm - Called when the user confirms the action
 */
function DeleteButton({
  label,
  message,
  disabled,
  onConfirm,
}: {
  label: string;
  message: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <InlineConfirm
        message={message}
        onConfirm={() => {
          setConfirming(false);
          onConfirm();
        }}
        onDismiss={() => setConfirming(false)}
        isPending={disabled}
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => setConfirming(true)}
    >
      {label}
    </Button>
  );
}

/**
 * Admin editor for the operating calendar. Two sections: responsibility areas
 * (name/color/sort) and events (area, fields, and month/day occurrences). All
 * mutations go through server actions; on success the router refreshes so the
 * server re-fetches.
 *
 * @param areas       - All responsibility areas from the DB
 * @param events      - All calendar events from the DB
 * @param occurrences - All event occurrences from the DB
 */
export function CalendarAdmin({ areas, events, occurrences }: CalendarAdminProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Runs a server action, surfaces its error message if any, and refreshes
   * the router on success so the server re-fetches updated data.
   *
   * @param fn - Async action returning an error message or undefined
   */
  const run = (fn: () => Promise<string | undefined>) => {
    setError(null);
    startTransition(async () => {
      const message = await fn();
      if (message) setError(message);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SectionCard title="Responsibility Areas">
        <AreaEditor areas={areas} disabled={isPending} run={run} />
      </SectionCard>

      <SectionCard title="Events">
        <EventEditor
          areas={areas}
          events={events}
          occurrences={occurrences}
          disabled={isPending}
          run={run}
        />
      </SectionCard>
    </div>
  );
}

/**
 * Area list with inline add and delete. New areas are appended with
 * sort_order = current count + 1.
 *
 * @param areas    - Current areas from the DB
 * @param disabled - Whether interactions are disabled (transition in flight)
 * @param run      - Shared action runner from CalendarAdmin
 */
function AreaEditor({
  areas,
  disabled,
  run,
}: {
  areas: ResponsibilityArea[];
  disabled: boolean;
  run: (fn: () => Promise<string | undefined>) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f766e");

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {areas.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: a.color }}
            />
            <span className="flex-1 text-sm">{a.name}</span>
            <DeleteButton
              label="Delete"
              message={`Delete "${a.name}"?`}
              disabled={disabled}
              onConfirm={() => run(() => deleteArea(a.id))}
            />
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="New area name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
          />
        </div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Area color"
          className="h-8 w-12 rounded border border-border"
        />
        <Button
          disabled={disabled || !name.trim()}
          onClick={() =>
            run(async () => {
              const msg = await saveArea({
                name,
                color,
                sortOrder: areas.length + 1,
              });
              if (!msg) setName("");
              return msg;
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/**
 * Event list with an add/edit form covering area, all text fields, and
 * month + optional day occurrences. Editing an existing event hydrates the
 * form from the current DB values.
 *
 * @param areas       - Responsibility areas for the area dropdown
 * @param events      - Current events from the DB
 * @param occurrences - All occurrences (filtered per event when editing)
 * @param disabled    - Whether interactions are disabled (transition in flight)
 * @param run         - Shared action runner from CalendarAdmin
 */
function EventEditor({
  areas,
  events,
  occurrences,
  disabled,
  run,
}: {
  areas: ResponsibilityArea[];
  events: CalendarEvent[];
  occurrences: EventOccurrence[];
  disabled: boolean;
  run: (fn: () => Promise<string | undefined>) => void;
}) {
  const [draft, setDraft] = useState<EventInput | null>(null);

  /** Opens the form for an existing event, hydrating its occurrences. */
  const editExisting = (event: CalendarEvent) => {
    setDraft({
      id: event.id,
      areaId: event.area_id,
      title: event.title,
      responsibleParty: event.responsible_party,
      notes: event.notes,
      templateUrl: event.template_url,
      occurrences: occurrences
        .filter((o) => o.event_id === event.id)
        .map((o) => ({ month: o.month, dayOfMonth: o.day_of_month })),
    });
  };

  /** Toggles a month on/off in the draft (day defaults to null = month-end). */
  const toggleMonth = (month: number) => {
    if (!draft) return;
    const has = draft.occurrences.some((o) => o.month === month);
    setDraft({
      ...draft,
      occurrences: has
        ? draft.occurrences.filter((o) => o.month !== month)
        : [...draft.occurrences, { month, dayOfMonth: null }],
    });
  };

  /** Sets the optional day for a selected month. */
  const setDay = (month: number, day: number | null) => {
    if (!draft) return;
    setDraft({
      ...draft,
      occurrences: draft.occurrences.map((o) =>
        o.month === month ? { ...o, dayOfMonth: day } : o
      ),
    });
  };

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2">
            <span className="flex-1 text-sm">
              <span className="font-medium">{e.title}</span>{" "}
              <span className="text-xs text-muted-foreground">
                · {areaName(e.area_id)}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => editExisting(e)}
            >
              Edit
            </Button>
            <DeleteButton
              label="Delete"
              message={`Delete "${e.title}"?`}
              disabled={disabled}
              onConfirm={() => run(() => deleteEvent(e.id))}
            />
          </li>
        ))}
      </ul>

      {draft === null ? (
        <Button
          variant="outline"
          disabled={disabled || areas.length === 0}
          onClick={() => setDraft(emptyEvent(areas[0]?.id ?? ""))}
        >
          Add event
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-border p-4">
          <select
            value={draft.areaId}
            onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-label="Area"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Input
            placeholder="Responsible party (optional)"
            value={draft.responsibleParty ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, responsibleParty: e.target.value || null })
            }
          />
          <Input
            placeholder="Notes (optional)"
            value={draft.notes ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, notes: e.target.value || null })
            }
          />
          <Input
            placeholder="Template URL (optional)"
            value={draft.templateUrl ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, templateUrl: e.target.value || null })
            }
          />

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Months (leave day blank for end-of-month)
            </p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {MONTHS.map((m) => {
                const occ = draft.occurrences.find((o) => o.month === m);
                return (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!occ}
                      onChange={() => toggleMonth(m)}
                    />
                    <span className="w-9">{monthName(m).slice(0, 3)}</span>
                    {occ ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="day"
                        value={occ.dayOfMonth ?? ""}
                        onChange={(e) =>
                          setDay(
                            m,
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="w-16 rounded border border-border px-1 py-0.5 text-xs"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              disabled={disabled}
              onClick={() => {
                const payload = draft;
                run(async () => {
                  const msg = await saveEvent(payload);
                  if (!msg) setDraft(null);
                  return msg;
                });
              }}
            >
              Save
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
