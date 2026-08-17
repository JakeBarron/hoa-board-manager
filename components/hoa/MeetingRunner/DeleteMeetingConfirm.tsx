"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DeleteMeetingConfirmProps {
  onConfirm: () => void;
  onDismiss: () => void;
  isPending: boolean;
}

/**
 * Inline confirmation for permanently deleting a meeting that has not started.
 * The delete cascades to motions, votes, documents, and pre-meeting updates, so
 * it says so.
 *
 * @param onConfirm - Performs the delete
 * @param onDismiss - Keeps the meeting
 * @param isPending - True while the delete is in flight
 */
export function DeleteMeetingConfirm({
  onConfirm,
  onDismiss,
  isPending,
}: DeleteMeetingConfirmProps) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex flex-wrap items-start justify-between gap-4">
      <p className="text-sm text-destructive font-medium">
        Delete this meeting? Any pre-meeting updates submitted for it are deleted
        too. This cannot be undone.
      </p>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Deleting…" : "Delete meeting"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={isPending}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
