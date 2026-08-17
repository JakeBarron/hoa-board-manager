"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MeetingRunner } from "@/components/hoa/MeetingRunner";
import type { Position } from "@/components/hoa/MeetingRunner";

interface StartMeetingButtonProps {
  positions: Position[];
  meetingId: string;
  meetingDate: string;
  /** "pending" starts the meeting; "in_progress" resumes it. Defaults to "pending". */
  status?: "pending" | "in_progress";
  /** Voting members needed for quorum, from `settings.quorum_required`. */
  quorumRequired: number;
}

/**
 * Launches the full-screen meeting runner. For a pending meeting it starts the
 * meeting (the queue invariant is enforced server-side — only the earliest
 * meeting may be started, and one already underway cannot be started again); for
 * an in-progress meeting it resumes, restoring saved minutes and attendance.
 *
 * Refreshes the route on close so the page reflects whatever the runner changed.
 *
 * @param positions      - All board positions for the runner's panels
 * @param meetingId      - UUID of the meeting to run
 * @param meetingDate    - ISO date (YYYY-MM-DD) of the meeting
 * @param status         - "pending" to start, "in_progress" to resume
 * @param quorumRequired - Voting members needed for quorum
 */
export function StartMeetingButton({
  positions,
  meetingId,
  meetingDate,
  status = "pending",
  quorumRequired,
}: StartMeetingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isResuming = status === "in_progress";

  const handleClose = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {isResuming ? "Resume Meeting" : "Start Meeting"}
      </Button>

      {open && (
        <MeetingRunner
          positions={positions}
          existingMeeting={isResuming ? { id: meetingId, status: "in_progress" } : null}
          onClose={handleClose}
          meetingId={meetingId}
          meetingDate={meetingDate}
          quorumRequired={quorumRequired}
        />
      )}
    </>
  );
}
