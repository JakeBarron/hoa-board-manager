"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingModal } from "@/components/hoa/ScheduleMeetingModal";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { MeetingRunnerModal } from "@/components/hoa/MeetingRunnerModal";
import { MeetingRow } from "./MeetingRow";
import type { Meeting } from "@/types/database";

interface Position {
  id: string;
  name: string;
  role: string;
  is_voting_member: boolean;
  display_name: string | null;
}

interface MeetingListClientProps {
  /** Whether the logged-in user can run meetings (officer or president) */
  canRun: boolean;
  /** Whether the logged-in user can schedule meetings (officer or president) */
  canSchedule: boolean;
  /** All 8 board positions for attendance and vote panels */
  positions: Position[];
  /** UUID of the logged-in user's position */
  currentPositionId: string;
  /** Any currently in-progress meeting — used to detect conflicts when starting a new one */
  existingMeeting: { id: string; status: "pending" | "in_progress" } | null;
  /** Upcoming meetings (not yet adjourned, meeting_date >= today) */
  upcoming: Pick<Meeting, "id" | "meeting_date" | "status">[];
  /** Past meetings */
  past: Pick<Meeting, "id" | "meeting_date" | "status">[];
  /** Google Drive folder URL from settings */
  driveFolder?: string;
  /** HOA name from settings */
  hoaName?: string;
  /** ISO date (YYYY-MM-DD) pre-filled in the schedule modal — next available cadence date */
  defaultScheduleDate: string;
}

/**
 * Client wrapper for the meetings list page.
 *
 * Handles modal open/close state so the server page can stay a pure
 * data-fetching Server Component. "Start Meeting" lives on each pending row;
 * clicking it opens the runner modal directly (no server call needed).
 *
 * @param canRun              - Whether the current user can run meetings
 * @param canSchedule         - Whether the current user can schedule meetings
 * @param positions           - All board positions (passed through to the modal)
 * @param currentPositionId   - Current user's position UUID
 * @param existingMeeting     - Any currently in-progress meeting, used as a conflict guard
 * @param upcoming            - Upcoming meeting rows
 * @param past                - Past meeting rows
 * @param defaultScheduleDate - ISO date pre-filled in the schedule modal (next available cadence date)
 */
export function MeetingListClient({
  canRun,
  canSchedule,
  positions,
  currentPositionId,
  existingMeeting,
  upcoming,
  past,
  driveFolder,
  hoaName,
  defaultScheduleDate,
}: MeetingListClientProps) {
  const [modalMeetingId, setModalMeetingId] = useState<string | null>(null);
  const [resolvedExistingMeeting, setResolvedExistingMeeting] =
    useState(existingMeeting);
  const [startError, setStartError] = useState<string | null>(null);
  const [startErrorRowId, setStartErrorRowId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const handleStartMeeting = (
    meetingId: string,
    meetingStatus: "pending" | "in_progress"
  ) => {
    setStartError(null);
    setStartErrorRowId(null);
    if (
      resolvedExistingMeeting?.status === "in_progress" &&
      resolvedExistingMeeting.id !== meetingId
    ) {
      setStartError(
        "A meeting is already in progress — adjourn it before starting a new one."
      );
      setStartErrorRowId(meetingId);
      return;
    }
    setResolvedExistingMeeting({ id: meetingId, status: meetingStatus });
    setModalMeetingId(meetingId);
  };

  const handleClose = () => {
    setModalMeetingId(null);
  };

  const modalMeeting = modalMeetingId
    ? [...upcoming, ...past].find((m) => m.id === modalMeetingId)
    : null;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Meetings"
          subtitle="Board meeting schedule"
          action={
            canSchedule ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowScheduleModal(true)}
              >
                Schedule meeting
              </Button>
            ) : undefined
          }
        />

        <SectionCard title="Upcoming">
          {upcoming.length === 0 ? (
            <EmptyState
              title="No meetings scheduled"
              description={
                canSchedule
                  ? "Use the button above to schedule the next board meeting."
                  : "No upcoming meetings have been scheduled yet."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((m) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  canSchedule={canSchedule}
                  canRun={canRun}
                  onStartMeeting={handleStartMeeting}
                  startError={startErrorRowId === m.id ? startError ?? undefined : undefined}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        {past.length > 0 && (
          <SectionCard title="Past">
            <ul className="divide-y divide-border">
              {past.map((m) => (
                <MeetingRow key={m.id} meeting={m} canSchedule={canSchedule} />
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {showScheduleModal && (
        <ScheduleMeetingModal
          positionId={currentPositionId}
          defaultDate={defaultScheduleDate}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {modalMeetingId && modalMeeting && (
        <MeetingRunnerModal
          positions={positions}
          currentPositionId={currentPositionId}
          existingMeeting={resolvedExistingMeeting}
          onClose={handleClose}
          meetingId={modalMeetingId}
          meetingDate={modalMeeting.meeting_date}
          driveFolder={driveFolder}
          hoaName={hoaName}
        />
      )}
    </>
  );
}
