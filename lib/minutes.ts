/**
 * Returns true when a stored minutes HTML string contains readable text.
 *
 * A non-empty string is not enough on its own: Tiptap serializes an empty
 * document as `<p></p>`. Markup, `&nbsp;` entities, and surrounding whitespace
 * are stripped before the check.
 *
 * **Known gap:** this only detects a *literally* empty body. It does NOT detect
 * an untouched agenda scaffold. `buildMeetingScaffold` (`lib/agenda.ts:116`)
 * emits real prose for every section — "Called to order by …", "Present: …",
 * and a placeholder body per position ("—", or "No update submitted." from an
 * earlier revision) — so a meeting that was opened in the runner and adjourned
 * without a word typed still returns true here. Three such rows exist in e2e.
 * Closing that gap needs an exact signal rather than boilerplate matching; see
 * `docs/specs/require-minutes-on-adjourn.md`.
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
