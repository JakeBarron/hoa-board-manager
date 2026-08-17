"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMeetingDate } from "@/lib/dates";
import type { SaveStatus } from "./useAutosave";
import { PRE_START_VIEWS, type RunnerView } from "./types";

export interface TopBarProps {
  meetingDate: string;
  elapsed: string;
  view: RunnerView;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  onCallVote: () => void;
  onCreateActionItem: () => void;
  onAdjourn: () => void;
  /** Permanently deletes the meeting. Only offered before it starts. */
  onDeleteMeeting: () => void;
  /** Leaves the runner without changing the meeting. */
  onExit: () => void;
}

/**
 * Reports whether the live minutes are safely written.
 *
 * Worth the space: the operator is typing the only record of the meeting, and
 * before autosave existed there was no way to tell whether any of it had been
 * persisted.
 *
 * @param status      - Current autosave state
 * @param lastSavedAt - When the last successful write completed
 */
function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Saving…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span role="alert" className="text-xs font-medium text-destructive">
        Not saved — check your connection
      </span>
    );
  }

  const stamp = lastSavedAt?.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span className="text-xs text-muted-foreground">
      Saved{stamp ? ` ${stamp}` : ""}
    </span>
  );
}

/**
 * Fixed header for the runner: meeting date, elapsed time, save state, and the
 * controls available in the current view.
 *
 * Deleting the meeting is offered only before it starts, and is labelled for
 * what it does. It used to read "Cancel" — the same word the sub-panels use to
 * mean "go back" — while actually hard-deleting the meeting and everything
 * cascading from it.
 *
 * @param props - Meeting identity, save state, current view, and handlers
 */
export function TopBar({
  meetingDate,
  elapsed,
  view,
  saveStatus,
  lastSavedAt,
  onCallVote,
  onCreateActionItem,
  onAdjourn,
  onDeleteMeeting,
  onExit,
}: TopBarProps) {
  const isRunning = view === "running";
  const isPreStart = PRE_START_VIEWS.includes(view);
  const hasAdjourned = view === "export";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold">{formatMeetingDate(meetingDate)}</span>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">{elapsed}</span>
        <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isRunning && (
          <>
            <Button size="sm" variant="outline" onClick={onCallVote}>
              Call Vote
            </Button>
            <Button size="sm" variant="outline" onClick={onCreateActionItem}>
              Create Action Item
            </Button>
            <Button size="sm" variant="destructive" onClick={onAdjourn}>
              Adjourn
            </Button>
          </>
        )}
        {isPreStart && (
          <Button size="sm" variant="ghost" onClick={onDeleteMeeting}>
            Delete this meeting
          </Button>
        )}
        {!hasAdjourned && (
          <Button size="sm" variant="ghost" onClick={onExit}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
