"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { InlineDateInput } from "@/components/hoa/InlineDateInput";
import { cancelMeeting, rescheduleMeeting } from "@/actions/meetings";
import { formatMeetingDate } from "@/lib/dates";
import type { Meeting } from "@/types/database";
import type { AppStatus } from "@/components/hoa/StatusBadge";

type RowMode = "default" | "confirmCancel" | "reschedule";

interface MeetingRowProps {
  meeting: Pick<Meeting, "id" | "meeting_date" | "status">;
  /** Whether the current user has officer/president permission to cancel or reschedule */
  canSchedule: boolean;
}

/**
 * Single row in the meetings list. Renders a link to /meetings/[id] with a
 * StatusBadge. For pending meetings when canSchedule is true, shows inline
 * Reschedule and Cancel actions that expand in-place without a modal.
 *
 * @param meeting     - Partial meeting row with id, meeting_date, and status
 * @param canSchedule - Whether the current user can cancel or reschedule
 */
export function MeetingRow({ meeting, canSchedule }: MeetingRowProps) {
  const [mode, setMode] = useState<RowMode>("default");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showActions = canSchedule && meeting.status === "pending";

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      try {
        await cancelMeeting(meeting.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel meeting.");
        setMode("default");
      }
    });
  };

  const handleReschedule = (newDate: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await rescheduleMeeting(meeting.id, newDate);
        setMode("default");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reschedule meeting.");
      }
    });
  };

  return (
    <li>
      <div className="flex items-center justify-between py-3 px-1">
        <Link
          href={`/meetings/${meeting.id}`}
          className="text-sm font-medium hover:underline"
        >
          {formatMeetingDate(meeting.meeting_date)}
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={meeting.status as AppStatus} />
          {showActions && mode === "default" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setError(null); setMode("reschedule"); }}
              >
                Reschedule
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setError(null); setMode("confirmCancel"); }}
              >
                Cancel
              </Button>
            </>
          )}
          {showActions && mode === "confirmCancel" && (
            <InlineConfirm
              message={`Cancel the ${formatMeetingDate(meeting.meeting_date)} meeting?`}
              confirmLabel="Yes, cancel"
              onConfirm={handleCancel}
              onDismiss={() => { setMode("default"); setError(null); }}
              isPending={isPending}
            />
          )}
        </div>
      </div>
      {showActions && mode === "reschedule" && (
        <InlineDateInput
          onSave={handleReschedule}
          onCancel={() => { setMode("default"); setError(null); }}
          isPending={isPending}
        />
      )}
      {error && (
        <p role="alert" className="px-1 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
