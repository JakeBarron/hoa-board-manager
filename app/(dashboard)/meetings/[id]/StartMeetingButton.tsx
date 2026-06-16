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
  driveFolder?: string;
  hoaName?: string;
}

/**
 * "Start Meeting" button for the prep view. Launches the full-screen meeting
 * runner for this pending meeting. The runner enforces the queue invariant
 * server-side (only the earliest meeting may be started), surfacing an error if
 * a different meeting must run first.
 *
 * @param positions         - All board positions for the runner's panels
 * @param currentPositionId - Logged-in user's position UUID
 * @param meetingId         - UUID of the meeting to start
 * @param meetingDate       - ISO date (YYYY-MM-DD) of the meeting
 */
export function StartMeetingButton({
  positions,
  currentPositionId,
  meetingId,
  meetingDate,
  driveFolder,
  hoaName,
}: StartMeetingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Start Meeting
      </Button>

      {open && (
        <MeetingRunnerModal
          positions={positions}
          currentPositionId={currentPositionId}
          existingMeeting={null}
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
