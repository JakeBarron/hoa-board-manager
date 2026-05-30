"use client";

import { recordReminderSent } from "@/actions/meetings";

interface Props {
  meetingId: string | null;
  reminderSentAt: string | null;
  boardMailto: string | null;
  chairMailto: string | null;
  allMailto: string | null;
}

/**
 * Reminder buttons for the agenda page.
 * Each link records the send timestamp on click (when a real meeting is scheduled).
 * Shows a warning if a reminder has already been sent.
 */
export function ReminderSection({
  meetingId,
  reminderSentAt,
  boardMailto,
  chairMailto,
  allMailto,
}: Props) {
  const handleClick = () => {
    if (meetingId) recordReminderSent(meetingId);
  };

  return (
    <div className="space-y-3">
      {reminderSentAt && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A reminder was last sent on{" "}
          {new Date(reminderSentAt).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          . The buttons below are still active if you need to re-send.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {boardMailto && (
          <a
            href={boardMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind Board
          </a>
        )}
        {chairMailto && (
          <a
            href={chairMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind Chairs
          </a>
        )}
        {allMailto && (
          <a
            href={allMailto}
            onClick={handleClick}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Remind All
          </a>
        )}
      </div>
    </div>
  );
}
