import type { PositionName, VoteChoice } from "@/types/database";
import { formatMeetingDate } from "@/lib/dates";

/**
 * Board positions in the order they report at a meeting. Shared by the agenda
 * prep view and the meeting scaffold so both render the same sequence.
 */
export type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social" | "grounds"
>;

/** Committee chairs in the order they report at a meeting. */
export type ChairPositionName = Extract<
  PositionName,
  "web" | "architecture" | "welcoming" | "clubhouse" | "cra"
>;

export const BOARD_POSITION_ORDER: BoardPositionName[] = [
  "president", "vp", "secretary", "treasurer",
  "pool", "membership", "tennis", "social", "grounds",
];

export const COMMITTEE_POSITION_ORDER: ChairPositionName[] = [
  "web", "architecture", "welcoming", "clubhouse", "cra",
];

/** A single board/committee report line: a label and the submitted update (or null). */
export interface ScaffoldReport {
  /** Pre-formatted label, e.g. "Treasurer" or "Treasurer — Jane Doe". */
  label: string;
  /** The position's pre-meeting update text, or null if not submitted. */
  content: string | null;
}

/** A single new-business item entered by the meeting runner. */
export interface NewBusinessItem {
  title: string;
  note?: string | null;
}

export interface MeetingScaffoldInput {
  /** Pre-formatted name of who called the meeting to order. */
  calledByName: string;
  /** Pre-formatted name of who seconded. */
  secondedByName: string;
  /** Pre-formatted names of members marked present. */
  presentNames: string[];
  /** Whether quorum was met at call to order. */
  quorumMet: boolean;
  /** The most recent prior minutes for the approval item, or null. */
  priorMinutes: { date: string; url: string | null } | null;
  /** Board reports in `BOARD_POSITION_ORDER`. */
  boardReports: ScaffoldReport[];
  /** Committee reports in `COMMITTEE_POSITION_ORDER`. */
  committeeReports: ScaffoldReport[];
  /** New-business items entered by the runner before the meeting. */
  newBusiness: NewBusinessItem[];
}

/**
 * Escapes a string for safe inclusion in HTML text content / attributes.
 *
 * @param value - Raw text (position names, update content, new business)
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapes text and converts newlines to hard breaks so multi-line pre-meeting
 * updates keep their line structure inside the Tiptap minutes editor.
 *
 * @param value - Raw multi-line text
 */
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/**
 * Renders one report section (Board or Committee) as HTML: a heading per
 * position with its submitted update, or a "No update submitted" placeholder.
 *
 * @param heading - Section heading text
 * @param reports - Ordered report lines
 */
function renderReportSection(heading: string, reports: ScaffoldReport[]): string {
  const rows = reports
    .map((r) => {
      const body = r.content && r.content.trim().length > 0
        ? `<p>${escapeMultiline(r.content)}</p>`
        : `<p>—</p>`;
      return `<h3>${escapeHtml(r.label)}</h3>${body}`;
    })
    .join("");
  return `<h2>${escapeHtml(heading)}</h2>${rows}`;
}

/**
 * Builds the initial minutes HTML that seeds the meeting runner's editor when a
 * meeting is called to order. Lays out the standard HOA meeting order — call to
 * order, approval of prior minutes, board reports, committee reports, new
 * business, adjournment — with every pre-meeting update folded inline so a
 * first-time runner can follow the meeting top to bottom.
 *
 * Pure: all names must be pre-formatted by the caller (via `formatPersonName`)
 * and all updates passed in as data. Returns Tiptap-compatible HTML.
 *
 * @param input - The data to render into the scaffold
 * @returns Minutes HTML string
 */
export function buildMeetingScaffold(input: MeetingScaffoldInput): string {
  const {
    calledByName, secondedByName, presentNames, quorumMet,
    priorMinutes, boardReports, committeeReports, newBusiness,
  } = input;

  const present = presentNames.length > 0
    ? presentNames.map(escapeHtml).join(", ")
    : "None recorded";
  const quorum = quorumMet ? "Quorum met." : "Quorum not met.";

  const callToOrder =
    `<h2>Call to Order</h2>` +
    `<p>Called to order by ${escapeHtml(calledByName)}, seconded by ${escapeHtml(secondedByName)}.</p>` +
    `<p>Present: ${present}. ${quorum}</p>`;

  const priorMinutesBody = priorMinutes
    ? `<p>Minutes of ${escapeHtml(formatMeetingDate(priorMinutes.date))}.` +
      (priorMinutes.url ? ` <a href="${escapeHtml(priorMinutes.url)}">View minutes</a>.` : "") +
      `</p>`
    : `<p><em>No prior minutes on file.</em></p>`;
  const approval = `<h2>Approval of Prior Minutes</h2>${priorMinutesBody}`;

  const board = renderReportSection("Board Reports", boardReports);
  const committee = renderReportSection("Committee Reports", committeeReports);

  const newBusinessBody = newBusiness.length > 0
    ? `<ul>${newBusiness
        .map((item) => {
          const note = item.note && item.note.trim().length > 0
            ? `: ${escapeMultiline(item.note)}`
            : "";
          return `<li>${escapeHtml(item.title)}${note}</li>`;
        })
        .join("")}</ul>`
    : `<p><em>None.</em></p>`;
  const newBusinessSection = `<h2>New Business</h2>${newBusinessBody}`;

  const adjournment = `<h2>Adjournment</h2><p></p>`;

  return [callToOrder, approval, board, committee, newBusinessSection, adjournment].join("");
}

/** One member's recorded vote, with a display name already formatted. */
export interface NamedVote {
  name: string;
  vote: VoteChoice;
}

/** A motion's outcome as tallied by the server from the persisted votes. */
export interface VoteTally {
  yay: number;
  nay: number;
  abstain: number;
  absent: number;
  passed: boolean;
}

export interface VoteResultTextInput {
  /** Motion title, already trimmed. */
  title: string;
  /** Pre-formatted name of the proposer, e.g. "President Jake Barron". */
  callerName: string;
  /** Pre-formatted name of the seconder. */
  seconderName: string;
  /** Authoritative counts, from `recordMotion`. */
  tally: VoteTally;
  /** Every recorded vote, used only to name who dissented, abstained, or was absent. */
  votes: NamedVote[];
  /** Optional detail appended after the title. */
  description?: string | null;
}

/**
 * Builds the sentence describing a motion's outcome for insertion into the
 * minutes.
 *
 * The counts come from the server's tally rather than being recomputed here, so
 * the prose in the minutes can never disagree with the `motion_votes` rows. The
 * tally is rendered explicitly as yay–nay–abstain because abstentions are a
 * distinct outcome from absences: an earlier three-bucket version dropped them
 * entirely, rendering a 3–1 vote with two abstentions as "Passed 3–1–0".
 *
 * Pure — all names must be pre-formatted by the caller via `formatPersonName`.
 *
 * @param input - Motion text, participants, the server tally, and the vote list
 * @returns A single plain-text sentence (no markup)
 */
export function buildVoteResultText(input: VoteResultTextInput): string {
  const { title, callerName, seconderName, tally, votes, description } = input;

  const namesVoting = (choice: VoteChoice): string[] =>
    votes.filter((v) => v.vote === choice).map((v) => v.name);

  const clauses: string[] = [];
  const nays = namesVoting("nay");
  const abstained = namesVoting("no_vote");
  const away = namesVoting("absent");

  if (nays.length > 0) clauses.push(`Nay: ${nays.join(", ")}.`);
  if (abstained.length > 0) clauses.push(`Abstained: ${abstained.join(", ")}.`);
  if (away.length > 0) clauses.push(`Absent: ${away.join(", ")}.`);

  const narrative = clauses.length > 0 ? clauses.join(" ") : "Unanimous.";
  const titlePart = description ? `${title}: ${description}` : title;
  const outcome = tally.passed ? "Passed" : "Failed";

  return (
    `Motion to ${titlePart} — called by ${callerName}, seconded by ${seconderName}. ` +
    `${outcome} ${tally.yay}–${tally.nay}–${tally.abstain} (yay–nay–abstain). ${narrative}`
  );
}
