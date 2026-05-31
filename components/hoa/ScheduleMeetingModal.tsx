"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createMeeting } from "@/actions/meetings";

export interface ScheduleMeetingModalProps {
  /** UUID of the current user's board position */
  positionId: string;
  /** ISO date string (YYYY-MM-DD) to pre-fill — computed from meeting cadence */
  defaultDate: string;
  /** Called when the modal should close (success or cancel) */
  onClose: () => void;
}

/**
 * Simple modal dialog for scheduling a new board meeting.
 * Pre-fills the date input with the next available cadence date.
 * Closes on success or when the user clicks Cancel or the backdrop.
 *
 * @param positionId  - UUID of the position calling the meeting
 * @param defaultDate - ISO date pre-filled in the date picker
 * @param onClose     - Called to dismiss the modal
 */
export function ScheduleMeetingModal({
  positionId,
  defaultDate,
  onClose,
}: ScheduleMeetingModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const isValid = Boolean(date) && date >= today;

  const handleSchedule = () => {
    setError(null);
    startTransition(async () => {
      try {
        await createMeeting(positionId, date);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to schedule meeting."
        );
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-base font-semibold">Schedule a Meeting</h2>

        <div className="space-y-1.5">
          <label htmlFor="schedule-date" className="text-sm font-medium">
            Meeting date
          </label>
          <input
            id="schedule-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            disabled={isPending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSchedule}
            disabled={!isValid || isPending}
          >
            {isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
