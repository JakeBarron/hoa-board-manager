"use client";

import { Button } from "@/components/ui/button";
import { formatMeetingDate } from "@/lib/dates";

export interface ExportPanelProps {
  meetingId: string;
  meetingDate: string;
  onClose: () => void;
}

/**
 * Shown once the meeting is adjourned. The minutes have already been rendered to
 * `.docx` and stored by `adjournMeeting`; this offers an on-demand download of
 * the same document.
 *
 * @param meetingId   - UUID of the adjourned meeting
 * @param meetingDate - ISO date of the meeting, for the heading
 * @param onClose     - Closes the runner
 */
export function ExportPanel({ meetingId, meetingDate, onClose }: ExportPanelProps) {
  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div>
        <h2 className="text-xl font-semibold">Meeting Adjourned</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatMeetingDate(meetingDate)} — minutes have been saved to Documents.
        </p>
      </div>

      <Button
        nativeButton={false}
        variant="outline"
        render={
          <a
            href={`/api/meetings/${meetingId}/export`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        Export Minutes (.docx)
      </Button>

      <Button onClick={onClose}>Close</Button>
    </div>
  );
}
