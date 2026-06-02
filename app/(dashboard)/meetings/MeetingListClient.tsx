"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingModal } from "@/components/hoa/ScheduleMeetingModal";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { MeetingRunnerModal } from "@/components/hoa/MeetingRunnerModal";
import { startOrResumeMeeting } from "@/actions/meetings";
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
  /** An existing open meeting for today, if any */
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
 * Handles modal open/close state and the startOrResumeMeeting call so the
 * server page can stay a pure data-fetching Server Component.
 *
 * @param canRun             - Whether the current user can run meetings
 * @param canSchedule        - Whether the current user can schedule meetings
 * @param positions          - All board positions (passed through to the modal)
 * @param currentPositionId  - Current user's position UUID
 * @param existingMeeting    - Any open meeting found for today
 * @param upcoming                - Upcoming meeting rows
 * @param past                    - Past meeting rows
 * @param defaultScheduleDate     - ISO date pre-filled in the schedule modal (next available cadence date)
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
  const [isPending, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const handleStartMeeting = () => {
    setStartError(null);
    startTransition(async () => {
      try {
        const result = await startOrResumeMeeting(currentPositionId);
        setResolvedExistingMeeting(result);
        setModalMeetingId(result.id);
      } catch (err) {
        setStartError(
          err instanceof Error ? err.message : "Failed to start meeting."
        );
      }
    });
  };

  const handleClose = () => {
    setModalMeetingId(null);
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Meetings"
          subtitle="Board meeting schedule"
          action={
            canSchedule ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowScheduleModal(true)}
                >
                  Schedule meeting
                </Button>
                {canRun && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleStartMeeting}
                    disabled={isPending}
                  >
                    {isPending ? "Starting…" : "Start Meeting"}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        {startError && (
          <p role="alert" className="text-xs text-destructive">
            {startError}
          </p>
        )}

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
                <MeetingRow key={m.id} meeting={m} canSchedule={canSchedule} />
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

      {modalMeetingId && (
        <MeetingRunnerModal
          positions={positions}
          currentPositionId={currentPositionId}
          existingMeeting={resolvedExistingMeeting}
          onClose={handleClose}
          meetingId={modalMeetingId}
          driveFolder={driveFolder}
          hoaName={hoaName}
        />
      )}
    </>
  );
}
