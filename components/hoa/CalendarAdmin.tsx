"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveArea,
  deleteArea,
  saveEvent,
  deleteEvent,
  type EventInput,
  type OccurrenceInput,
} from "@/actions/calendar";
import { monthName } from "@/lib/calendar/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const DEFAULT_AREA_COLOR = "#0f766e";

/** A function that runs a server action and reports its error (or undefined). */
type Runner = (fn: () => Promise<string | undefined>) => void;

/** Empty draft for a new event in the given area. */
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

/** Short label for an occurrence, e.g. "Mar 1" or "by Mar". */
function occurrenceLabel(occ: OccurrenceInput): string {
  const month = monthName(occ.month).slice(0, 3);
  return occ.dayOfMonth == null ? `by ${month}` : `${month} ${occ.dayOfMonth}`;
}

/**
 * One-line summary of an event's occurrences for the collapsed row, e.g.
 * "Every month" when all 12 are present, otherwise "Mar 1 · Jun · Sep".
 *
 * @param list - The event's occurrences (any order)
 */
function summarizeOccurrences(list: OccurrenceInput[]): string {
  if (list.length === 0) return "No dates";
  if (list.length === 12) return "Every month";
  return [...list]
    .sort((a, b) => a.month - b.month)
    .map(occurrenceLabel)
    .join(" · ");
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
 * Admin editor for the operating calendar, organised as one grouped list:
 * each responsibility area is a collapsible, color-coded section containing its
 * events, with a contextual "Add event" inside each section and an "Add area"
 * control at the bottom. All mutations go through server actions; on success the
 * router refreshes so the server re-fetches.
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
   * Runs a server action, surfaces its error message if any, and refreshes the
   * router on success so the server re-fetches updated data.
   *
   * @param fn - Async action returning an error message or undefined
   */
  const run: Runner = (fn) => {
    setError(null);
    startTransition(async () => {
      const message = await fn();
      if (message) setError(message);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a responsibility area below to start building the calendar.
        </p>
      ) : null}

      {areas.map((area) => (
        <AreaSection
          key={area.id}
          area={area}
          areas={areas}
          events={events.filter((e) => e.area_id === area.id)}
          occurrences={occurrences}
          disabled={isPending}
          run={run}
        />
      ))}

      <AddAreaForm
        maxSortOrder={Math.max(0, ...areas.map((a) => a.sort_order))}
        disabled={isPending}
        run={run}
      />
    </div>
  );
}

/**
 * A collapsible section for one responsibility area: a color-coded header
 * (with inline rename/recolor and delete) over the area's events, plus a
 * contextual add-event control. Only one event form is open at a time per area.
 *
 * @param area        - The area this section represents
 * @param areas       - All areas (for the event form's area dropdown)
 * @param events      - Events belonging to this area
 * @param occurrences - All occurrences (filtered per event when editing)
 * @param disabled    - Whether interactions are disabled (transition in flight)
 * @param run         - Shared action runner from CalendarAdmin
 */
function AreaSection({
  area,
  areas,
  events,
  occurrences,
  disabled,
  run,
}: {
  area: ResponsibilityArea;
  areas: ResponsibilityArea[];
  events: CalendarEvent[];
  occurrences: EventOccurrence[];
  disabled: boolean;
  run: Runner;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingArea, setEditingArea] = useState(false);
  const [draft, setDraft] = useState<EventInput | null>(null);

  /** Hydrates the form from an existing event's current values. */
  const editExisting = (event: CalendarEvent) =>
    setDraft({
      id: event.id,
      areaId: event.area_id,
      title: event.title,
      responsibleParty: event.responsible_party,
      notes: event.notes,
      templateUrl: event.template_url,
      occurrences: occurrences
        .filter((o) => o.event_id === event.id)
        .map((o) => ({ month: o.month, dayOfMonth: o.day_of_month }))
        .sort((a, b) => a.month - b.month),
    });

  /** Saves the current draft; closes the form on success. */
  const saveDraft = () => {
    const payload = draft;
    if (!payload) return;
    run(async () => {
      const message = await saveEvent(payload);
      if (!message) setDraft(null);
      return message;
    });
  };

  return (
    <section aria-label={area.name} className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${area.name}` : `Collapse ${area.name}`}
          className="text-sm text-muted-foreground"
        >
          {collapsed ? "▸" : "▾"}
        </button>

        {editingArea ? (
          <AreaHeaderEdit
            area={area}
            disabled={disabled}
            run={run}
            onDone={() => setEditingArea(false)}
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            <span className="flex-1 font-medium">{area.name}</span>
            <span className="text-xs text-muted-foreground">
              {events.length} {events.length === 1 ? "event" : "events"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setEditingArea(true)}
            >
              Edit
            </Button>
            <DeleteButton
              label="Delete"
              message={`Delete area "${area.name}"?`}
              disabled={disabled}
              onConfirm={() => run(() => deleteArea(area.id))}
            />
          </>
        )}
      </div>

      {collapsed ? null : (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {events.length === 0 && draft === null ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : null}

          {events.map((e) =>
            draft?.id === e.id ? (
              <EventForm
                key={e.id}
                draft={draft}
                areas={areas}
                disabled={disabled}
                onChange={setDraft}
                onSave={saveDraft}
                onCancel={() => setDraft(null)}
              />
            ) : (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-md px-1 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {summarizeOccurrences(
                      occurrences
                        .filter((o) => o.event_id === e.id)
                        .map((o) => ({ month: o.month, dayOfMonth: o.day_of_month }))
                    )}
                    {e.responsible_party ? ` · ${e.responsible_party}` : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || draft !== null}
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
              </div>
            )
          )}

          {draft !== null && draft.id === undefined ? (
            <EventForm
              draft={draft}
              areas={areas}
              disabled={disabled}
              onChange={setDraft}
              onSave={saveDraft}
              onCancel={() => setDraft(null)}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || draft !== null}
              onClick={() => setDraft(emptyEvent(area.id))}
            >
              + Add event
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Inline rename/recolor controls for an area header. Saves through saveArea,
 * preserving the area's existing sort order.
 *
 * @param area     - The area being edited
 * @param disabled - Whether interactions are disabled (transition in flight)
 * @param run      - Shared action runner
 * @param onDone   - Called to leave edit mode (after save or cancel)
 */
function AreaHeaderEdit({
  area,
  disabled,
  run,
  onDone,
}: {
  area: ResponsibilityArea;
  disabled: boolean;
  run: Runner;
  onDone: () => void;
}) {
  const [name, setName] = useState(area.name);
  const [color, setColor] = useState(area.color);

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Area color"
        className="h-8 w-10 shrink-0 rounded border border-border"
      />
      <Input
        aria-label="Area name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
        className="flex-1"
      />
      <Button
        size="sm"
        disabled={disabled || !name.trim()}
        onClick={() =>
          run(async () => {
            const message = await saveArea({
              id: area.id,
              name,
              color,
              sortOrder: area.sort_order,
            });
            if (!message) onDone();
            return message;
          })
        }
      >
        Save
      </Button>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onDone}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * The add/edit form for a single event: area, text fields, and the date
 * (month + optional day) editor. Controlled — the parent owns the draft.
 *
 * @param draft    - Current event draft
 * @param areas    - Areas for the area dropdown
 * @param disabled - Whether interactions are disabled (transition in flight)
 * @param onChange - Called with the next draft on any field change
 * @param onSave   - Called when Save is clicked
 * @param onCancel - Called when Cancel is clicked
 */
function EventForm({
  draft,
  areas,
  disabled,
  onChange,
  onSave,
  onCancel,
}: {
  draft: EventInput;
  areas: ResponsibilityArea[];
  disabled: boolean;
  onChange: (next: EventInput) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <select
        value={draft.areaId}
        onChange={(e) => onChange({ ...draft, areaId: e.target.value })}
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
        aria-label="Title"
        placeholder="Title"
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />
      <Input
        aria-label="Responsible party"
        placeholder="Responsible party (optional)"
        value={draft.responsibleParty ?? ""}
        onChange={(e) =>
          onChange({ ...draft, responsibleParty: e.target.value || null })
        }
      />
      <Input
        aria-label="Notes"
        placeholder="Notes (optional)"
        value={draft.notes ?? ""}
        onChange={(e) => onChange({ ...draft, notes: e.target.value || null })}
      />
      <Input
        aria-label="Template URL"
        placeholder="Template URL (optional)"
        value={draft.templateUrl ?? ""}
        onChange={(e) =>
          onChange({ ...draft, templateUrl: e.target.value || null })
        }
      />

      <OccurrenceEditor
        occurrences={draft.occurrences}
        disabled={disabled}
        onChange={(next) => onChange({ ...draft, occurrences: next })}
      />

      <div className="flex gap-2">
        <Button disabled={disabled} onClick={onSave}>
          Save
        </Button>
        <Button variant="outline" disabled={disabled} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Editor for an event's dates. Each occurrence is a row of a Month dropdown and
 * a Day dropdown ("End of month" = no specific day, the default). Months already
 * chosen in other rows are disabled to avoid duplicates. "Every month" fills all
 * twelve; "Add another date" appends the next free month.
 *
 * @param occurrences - The current occurrences
 * @param disabled    - Whether interactions are disabled (transition in flight)
 * @param onChange    - Called with the next occurrence list on any change
 */
function OccurrenceEditor({
  occurrences,
  disabled,
  onChange,
}: {
  occurrences: OccurrenceInput[];
  disabled: boolean;
  onChange: (next: OccurrenceInput[]) => void;
}) {
  const used = new Set(occurrences.map((o) => o.month));
  const firstFreeMonth = MONTHS.find((m) => !used.has(m));

  const setMonth = (index: number, month: number) =>
    onChange(occurrences.map((o, i) => (i === index ? { ...o, month } : o)));
  const setDay = (index: number, dayOfMonth: number | null) =>
    onChange(occurrences.map((o, i) => (i === index ? { ...o, dayOfMonth } : o)));
  const removeRow = (index: number) =>
    onChange(occurrences.filter((_, i) => i !== index));
  const addRow = () => {
    if (firstFreeMonth == null) return;
    onChange([...occurrences, { month: firstFreeMonth, dayOfMonth: null }]);
  };
  const everyMonth = () =>
    onChange(MONTHS.map((m) => ({ month: m, dayOfMonth: null })));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">When does it happen?</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || occurrences.length === 12}
          onClick={everyMonth}
        >
          Every month
        </Button>
      </div>

      {occurrences.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add at least one date below.
        </p>
      ) : null}

      {occurrences.map((occ, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            aria-label="Month"
            value={occ.month}
            disabled={disabled}
            onChange={(e) => setMonth(index, Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m} disabled={used.has(m) && m !== occ.month}>
                {monthName(m)}
              </option>
            ))}
          </select>
          <select
            aria-label="Day"
            value={occ.dayOfMonth ?? ""}
            disabled={disabled}
            onChange={(e) =>
              setDay(index, e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">End of month</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${monthName(occ.month)}`}
            disabled={disabled}
            onClick={() => removeRow(index)}
          >
            ✕
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        disabled={disabled || firstFreeMonth == null}
        onClick={addRow}
      >
        + Add another date
      </Button>
    </div>
  );
}

/**
 * Bottom-of-list control to add a new responsibility area. Collapsed to a
 * single button until opened; new areas sort after all existing ones.
 *
 * @param maxSortOrder - Highest existing sort_order (new area = max + 1)
 * @param disabled     - Whether interactions are disabled (transition in flight)
 * @param run          - Shared action runner
 */
function AddAreaForm({
  maxSortOrder,
  disabled,
  run,
}: {
  maxSortOrder: number;
  disabled: boolean;
  run: Runner;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_AREA_COLOR);

  if (!open) {
    return (
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        + Add area
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-md border border-border p-3">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Area color"
        className="h-8 w-10 shrink-0 rounded border border-border"
      />
      <div className="flex-1">
        <Input
          aria-label="New area name"
          placeholder="New area name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
      </div>
      <Button
        disabled={disabled || !name.trim()}
        onClick={() =>
          run(async () => {
            const message = await saveArea({
              name,
              color,
              sortOrder: maxSortOrder + 1,
            });
            if (!message) {
              setName("");
              setColor(DEFAULT_AREA_COLOR);
              setOpen(false);
            }
            return message;
          })
        }
      >
        Add
      </Button>
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          setName("");
          setOpen(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
