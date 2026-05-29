import type { PositionName } from "@/types/database";
import { formatMeetingDate } from "@/lib/dates";

const POSITION_LABELS: Record<PositionName, string> = {
  president: "President",
  vp: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  pool: "Pool",
  membership: "Membership",
  tennis: "Tennis",
  social: "Social",
};

interface ReminderParams {
  meetingDate: string;
  boardEmails: string[];
  missingPositions: PositionName[];
  appUrl: string;
}

/**
 * Builds a pre-filled mailto: URL for a board meeting reminder email.
 * Opens the user's email client with all board members in To:, the meeting
 * date in the subject, and a link to the pre-meeting update form in the body.
 *
 * @param meetingDate      - ISO date string (YYYY-MM-DD)
 * @param boardEmails      - Email addresses for the To: field
 * @param missingPositions - Positions that have not yet submitted an update
 * @param appUrl           - Base URL of the app (e.g. "https://example.com")
 * @returns A mailto: URL string safe for use in an href
 */
export function buildReminderMailto({
  meetingDate,
  boardEmails,
  missingPositions,
  appUrl,
}: ReminderParams): string {
  const dateLabel = formatMeetingDate(meetingDate);
  const subject = `Board Meeting Reminder — ${dateLabel}`;
  const preMeetingUrl = `${appUrl}/pre-meeting?date=${meetingDate}`;

  const missingSection =
    missingPositions.length > 0
      ? `\n\nNot yet submitted:\n${missingPositions
          .map((p) => `  - ${POSITION_LABELS[p]}`)
          .join("\n")}`
      : "";

  const body =
    `Reminder: Board meeting on ${dateLabel}.\n\n` +
    `Please submit your pre-meeting status update before the meeting:\n` +
    `${preMeetingUrl}${missingSection}\n\nThank you.`;

  return `mailto:${boardEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
