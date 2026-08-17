import type { VoteChoice } from "@/types/database";

/** A board position as passed from the server page. */
export interface Position {
  id: string;
  name: string;
  role: string;
  is_voting_member: boolean;
  display_name: string | null;
}

/**
 * The runner's screens.
 *
 * `newBusiness`, `attendance`, and `callToOrder` are the pre-start wizard and
 * replace the whole surface. `running` is the minutes editor, which stays
 * mounted for the rest of the meeting; `voting`, `actionItem`, `adjourn`, and
 * `export` render on top of it so the Tiptap instance — and with it undo
 * history, selection, and scroll position — survives.
 */
export type RunnerView =
  | "newBusiness"
  | "attendance"
  | "callToOrder"
  | "running"
  | "voting"
  | "actionItem"
  | "adjourn"
  | "export";

/** Views that make up the pre-start wizard. */
export const PRE_START_VIEWS: readonly RunnerView[] = [
  "newBusiness",
  "attendance",
  "callToOrder",
] as const;

/** Views drawn on top of the running minutes editor. */
export const OVERLAY_VIEWS: readonly RunnerView[] = [
  "voting",
  "actionItem",
  "adjourn",
  "export",
] as const;

/**
 * A member's vote in the vote panel. `null` means the operator has not chosen
 * yet — the panel refuses to submit until every present member has a choice, so
 * an untouched slate can never be recorded as a unanimous pass.
 */
export type PendingVote = VoteChoice | null;
