"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { canEditAll } from "@/lib/permissions";
import type { MotionStatus, PositionRole, VoteChoice } from "@/types/database";

/** One member's vote as captured by the meeting operator. */
export interface MotionVoteInput {
  positionId: string;
  vote: VoteChoice;
}

/** Everything the runner collects before a motion is recorded. */
export interface RecordMotionInput {
  title: string;
  description?: string | null;
  proposedBy: string;
  secondedBy: string;
  votes: MotionVoteInput[];
}

/** The authoritative outcome, tallied on the server from the persisted votes. */
export interface MotionResult {
  motionId: string;
  passed: boolean;
  yay: number;
  nay: number;
  abstain: number;
  absent: number;
  quorumMet: boolean;
}

/**
 * Resolves the caller's position id and role, throwing if they are not signed in
 * or hold no position.
 *
 * @param supabase - An initialised server Supabase client
 */
async function currentPosition(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ id: string; role: PositionRole }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("positions")
    .select("id, role")
    .eq("email", user.email)
    .single();

  if (!data) throw new Error("No position for current user");
  return { id: data.id, role: data.role };
}

/**
 * Reads the quorum threshold from settings, falling back to 5 when the setting
 * is missing or unparseable.
 *
 * @param supabase - An initialised server Supabase client
 */
async function quorumThreshold(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "quorum_required")
    .maybeSingle();

  const parsed = data ? parseInt(data.value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 5;
}

/**
 * Records a complete motion in one call: creates it already seconded, persists
 * every vote, tallies the outcome **from the rows that actually landed**, and
 * closes it.
 *
 * This replaces the former createMotion → secondMotion → recordVotes →
 * closeMotion sequence, where a failure partway through left a half-written
 * motion behind and a retry created a duplicate. Votes are written with
 * ON CONFLICT DO NOTHING so a retry is safe and never mutates a recorded vote —
 * `motion_votes` deliberately has no UPDATE policy.
 *
 * The pass/fail decision is made here rather than in the browser: a motion
 * carries more yays than nays among votes cast. Abstentions (`no_vote`) and
 * absences are recorded but do not count toward the majority. Quorum is
 * evaluated from the meeting's recorded attendance against
 * `settings.quorum_required`, and stored alongside the result rather than
 * gating it — a board can note that a vote was taken without quorum.
 *
 * Requires an officer or the president: the runner is single-operator, so the
 * caller legitimately records votes on other positions' behalf and
 * `recorded_by` carries the audit trail.
 *
 * @param meetingId - UUID of the meeting the motion belongs to
 * @param input     - Motion text, proposer, seconder, and the full vote slate
 * @returns The persisted motion id and the server-side tally
 */
export async function recordMotion(
  meetingId: string,
  input: RecordMotionInput
): Promise<MotionResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Motion title is required.");
  if (!input.proposedBy || !input.secondedBy) {
    throw new Error("A proposer and a seconder are required.");
  }
  if (input.proposedBy === input.secondedBy) {
    throw new Error("The proposer cannot also second the motion.");
  }
  if (input.votes.length === 0) {
    throw new Error("At least one vote is required.");
  }

  const supabase = await createClient();
  const { id: recordedBy, role } = await currentPosition(supabase);
  if (!canEditAll(role)) {
    throw new Error("Only the president or an officer can record a motion.");
  }

  const now = new Date().toISOString();

  // Created already seconded — the runner collects the second before submitting,
  // so there is no window in which an unseconded motion exists.
  const { data: motion, error: motionError } = await supabase
    .from("motions")
    .insert({
      meeting_id: meetingId,
      title,
      description: input.description?.trim() || null,
      proposed_by: input.proposedBy,
      seconded_by: input.secondedBy,
      seconded_at: now,
      status: "voting" satisfies MotionStatus,
    })
    .select("id")
    .single();

  if (motionError) throw new Error(motionError.message);
  const motionId = motion.id;

  const { error: votesError } = await supabase.from("motion_votes").upsert(
    input.votes.map(({ positionId, vote }) => ({
      motion_id: motionId,
      position_id: positionId,
      vote,
      recorded_by: recordedBy,
    })),
    { onConflict: "motion_id,position_id", ignoreDuplicates: true }
  );

  if (votesError) throw new Error(votesError.message);

  // Tally from what is actually stored, not from what the browser sent.
  const { data: stored, error: readError } = await supabase
    .from("motion_votes")
    .select("vote")
    .eq("motion_id", motionId);

  if (readError) throw new Error(readError.message);

  const tallyOf = (choice: VoteChoice): number =>
    (stored ?? []).filter((v) => v.vote === choice).length;

  const yay = tallyOf("yay");
  const nay = tallyOf("nay");
  const abstain = tallyOf("no_vote");
  const absent = tallyOf("absent");
  const passed = yay > nay;

  const quorumMet = await meetingHasQuorum(supabase, meetingId);

  const { error: closeError } = await supabase
    .from("motions")
    .update({
      status: (passed ? "passed" : "failed") satisfies MotionStatus,
      quorum_met: quorumMet,
      closed_at: new Date().toISOString(),
    })
    .eq("id", motionId);

  if (closeError) throw new Error(closeError.message);

  revalidatePath("/meetings", "layout");
  return { motionId, passed, yay, nay, abstain, absent, quorumMet };
}

/**
 * Returns whether the meeting's recorded attendance meets the configured quorum,
 * counting voting members only — committee chairs and any non-voting seat are
 * present at the meeting but do not count toward it.
 *
 * @param supabase  - An initialised server Supabase client
 * @param meetingId - UUID of the meeting whose attendance is being checked
 */
async function meetingHasQuorum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string
): Promise<boolean> {
  const [meetingResult, required] = await Promise.all([
    supabase
      .from("meetings")
      .select("present_positions")
      .eq("id", meetingId)
      .single(),
    quorumThreshold(supabase),
  ]);

  const presentIds = meetingResult.data?.present_positions ?? [];
  if (presentIds.length === 0) return false;

  const { data: voters } = await supabase
    .from("positions")
    .select("id")
    .in("id", presentIds)
    .eq("is_voting_member", true);

  return (voters?.length ?? 0) >= required;
}
