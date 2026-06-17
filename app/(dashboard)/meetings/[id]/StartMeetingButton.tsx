"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MeetingRunnerModal } from "@/components/hoa/MeetingRunnerModal";

interface Position {
  id: string;
  name: string;
  role: string;
  is_voting_member: boolean;
  display_name: string | null;
}

interface StartMeetingButtonProps {
  positions: Position[];
  currentPositionId: string;
  meetingId: string;
  meetingDate: string;
  /** "pending" starts the meeting; "in_progress" resumes it. Defaults to "pending". */
  status?: "pending" | "in_progress";
  driveFolder?: string;
  hoaName?: string;
}

/**
 * Launches the full-screen meeting runner for a meeting. For a pending meeting
 * it starts the meeting (the runner enforces the queue invariant server-side —
 * only the earliest meeting may be started); for an in-progress meeting it
 * resumes where it left off, restoring saved minutes and attendance.
 *
 * @param positions         - All board positions for the runner's panels
 * @param currentPositionId - Logged-in user's position UUID
 * @param meetingId         - UUID of the meeting to run
 * @param meetingDate       - ISO date (YYYY-MM-DD) of the meeting
 * @param status            - "pending" to start, "in_progress" to resume
 */
export function StartMeetingButton({
  positions,
  currentPositionId,
  meetingId,
  meetingDate,
  status = "pending",
  driveFolder,
  hoaName,
}: StartMeetingButtonProps) {
  const [open, setOpen] = useState(false);
  const isResuming = status === "in_progress";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {isResuming ? "Resume Meeting" : "Start Meeting"}
      </Button>

      {open && (
        <MeetingRunnerModal
          positions={positions}
          currentPositionId={currentPositionId}
          existingMeeting={isResuming ? { id: meetingId, status: "in_progress" } : null}
          onClose={() => setOpen(false)}
          meetingId={meetingId}
          meetingDate={meetingDate}
          driveFolder={driveFolder}
          hoaName={hoaName}
        />
      )}
    </>
  );
}
