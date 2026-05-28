"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VoteOutcome, ArchitectureStatus } from "@/types/database";

/**
 * Maps a vote outcome to the resulting architecture request status.
 * Unanimous and majority votes approve the request; denied votes deny it.
 *
 * @param outcome - The vote outcome recorded by the president
 * @returns The corresponding architecture request status
 */
const outcomeToStatus = (outcome: VoteOutcome): ArchitectureStatus =>
  outcome === "unanimous" || outcome === "majority" ? "approved" : "denied";

/**
 * Records the board's vote on an architecture request and updates its status.
 * Only the president can call this action — enforced by RLS on the DB side.
 * Revalidates the architecture list and detail pages on success.
 *
 * @param requestId - UUID of the architecture request being voted on
 * @param outcome   - Vote outcome: unanimous | majority | denied
 * @param ratio     - Free-text vote ratio, e.g. "5-2"
 * @param notes     - Optional notes from the president
 * @throws Error if the Supabase update fails
 */
export async function recordVote(
  requestId: string,
  outcome: VoteOutcome,
  ratio: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("architecture_requests")
    .update({
      status: outcomeToStatus(outcome),
      vote_outcome: outcome,
      vote_ratio: ratio.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath("/architecture", "layout");
}
