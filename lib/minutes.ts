/**
 * Returns true when a stored minutes HTML string contains readable text.
 *
 * A non-empty string is not enough on its own: Tiptap serializes an empty
 * document as `<p></p>`, and the meeting runner seeds `minutes_content` with an
 * agenda scaffold that can end up as nothing but empty tags. Markup, `&nbsp;`
 * entities, and surrounding whitespace are stripped before the check.
 *
 * @param content - Raw HTML from `meetings.minutes_content`, or null/undefined
 * @returns true when at least one non-whitespace character survives stripping
 */
export function hasMinutesContent(
  content: string | null | undefined
): boolean {
  if (!content) return false;
  const text = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length > 0;
}

/** One row of the /minutes archive. */
export interface MinutesArchiveRow {
  id: string;
  meetingDate: string;
  /** False when the meeting adjourned without a minutes body being saved */
  hasMinutes: boolean;
}

/**
 * Builds the row list for the /minutes archive.
 *
 * Every adjourned meeting is listed, including ones with no minutes body. A gap
 * in the record is marked rather than hidden — omitting those meetings would
 * make an unrecorded meeting look like it never happened.
 *
 * @param meetings - Adjourned meeting rows, already ordered by the caller
 * @returns One row per meeting, each flagged with whether minutes are on file
 */
export function toMinutesArchiveRows(
  meetings: {
    id: string;
    meeting_date: string;
    minutes_content: string | null;
  }[]
): MinutesArchiveRow[] {
  return meetings.map((meeting) => ({
    id: meeting.id,
    meetingDate: meeting.meeting_date,
    hasMinutes: hasMinutesContent(meeting.minutes_content),
  }));
}
