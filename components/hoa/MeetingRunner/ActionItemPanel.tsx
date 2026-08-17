"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createActionItem } from "@/actions/todos";
import { formatPersonName } from "@/lib/positions";
import type { PositionName } from "@/types/database";
import type { Position } from "./types";

export interface ActionItemPanelProps {
  positions: Position[];
  meetingId: string;
  /** Receives the assignee's display name and the item text on success. */
  onCreated: (assigneeName: string, title: string) => void;
  onCancel: () => void;
}

/**
 * Creates an action item (a `todos` row) assigned to a position and tied to this
 * meeting.
 *
 * Hands control back the moment the write succeeds. An earlier version showed a
 * confirmation for 800ms via an uncleared `setTimeout`, which re-enabled Cancel
 * during the window — backing out still fired the callback and appended a note
 * for an item the operator had just abandoned.
 *
 * A real `<form>`, so Enter from the description creates the item.
 *
 * @param positions - Positions the item can be assigned to
 * @param meetingId - UUID of the meeting in progress
 * @param onCreated - Called with the assignee name and title on success
 * @param onCancel  - Dismisses the panel without creating anything
 */
export function ActionItemPanel({
  positions,
  meetingId,
  onCreated,
  onCancel,
}: ActionItemPanelProps) {
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(positions[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const title = description.trim();
    if (!title) {
      setError("Description is required.");
      return;
    }
    if (!assignee) {
      setError("Please select an assignee.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await createActionItem(assignee, title, meetingId, dueDate || undefined);
        const position = positions.find((p) => p.id === assignee);
        onCreated(
          position
            ? formatPersonName(position.name as PositionName, position.display_name)
            : assignee,
          title
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create action item.");
      }
    });
  };

  return (
    <form
      onSubmit={handleCreate}
      className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Create Action Item</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="action-description" className="text-sm font-medium">
            Description <span className="text-destructive">*</span>
          </label>
          <input
            id="action-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Contact fence vendor for revised quote"
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="action-assignee" className="text-sm font-medium">
            Assignee <span className="text-destructive">*</span>
          </label>
          <select
            id="action-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.name as PositionName, p.display_name)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="action-due-date" className="text-sm font-medium">
            Due date (optional)
          </label>
          <input
            id="action-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
