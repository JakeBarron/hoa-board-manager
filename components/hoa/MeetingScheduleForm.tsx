"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/button";

interface MeetingScheduleFormProps {
  /** UUID of the current user's board position — passed as the caller */
  positionId: string;
}

/**
 * Form for scheduling a new board meeting.
 * Submits via the createMeeting server action and redirects to /meetings on success.
 *
 * @param positionId - UUID of the board position calling the meeting
 */
export function MeetingScheduleForm({ positionId }: MeetingScheduleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date) {
      setError("Please select a meeting date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createMeeting(positionId, date);
        router.push("/meetings");
      } catch {
        setError("Failed to schedule meeting. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="meeting-date" className="text-sm font-medium">
          Meeting date{" "}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="meeting-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isPending}
          required
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Scheduling…" : "Schedule meeting"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
