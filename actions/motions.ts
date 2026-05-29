"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MotionStatus, VoteChoice } from "@/types/database";

/**
 * Creates a new motion in 'proposed' status attached to a meeting.
 * Security enforced by RLS.
 *
 * @param meetingId   - UUID of the meeting this motion belongs to
 * @param title       - Short title of the motion
 * @param proposedBy  - Position ID of the member who proposed the motion
 * @param description - Optional longer description of the motion details
 * @returns The newly created motion row ID
 */
export async function createMotion(
  meetingId: string,
  title: string,
  proposedBy: string,
  description?: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("motions")
    .insert({
      meeting_id: meetingId,
      title,
      proposed_by: proposedBy,
      description: description ?? null,
      status: "proposed" satisfies MotionStatus,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  return { id: data.id };
}

/**
 * Records the seconder for a motion and moves it to 'seconded' status.
 * Should be called immediately after a member seconds the motion.
 *
 * @param motionId   - UUID of the motion being seconded
 * @param secondedBy - Position ID of the member who seconded the motion
 */
export async function secondMotion(
  motionId: string,
  secondedBy: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("motions")
    .update({
      seconded_by: secondedBy,
      seconded_at: new Date().toISOString(),
      status: "seconded" satisfies MotionStatus,
    })
    .eq("id", motionId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}

/**
 * Bulk-inserts vote records for all voting positions. Should be called once
 * with all votes for the motion at close time. The unique constraint on
 * (motion_id, position_id) prevents duplicate votes.
 *
 * @param motionId - UUID of the motion votes are being recorded for
 * @param votes    - Array of vote records; recordedBy is the secretary/president
 *                   who captured each board member's vote
 */
export async function recordVotes(
  motionId: string,
  votes: Array<{
    positionId: string;
    vote: "yay" | "nay" | "absent";
    recordedBy: string;
  }>
): Promise<void> {
  const supabase = await createClient();

  const rows = votes.map(({ positionId, vote, recordedBy }) => ({
    motion_id: motionId,
    position_id: positionId,
    vote: vote satisfies VoteChoice,
    recorded_by: recordedBy,
  }));

  const { error } = await supabase.from("motion_votes").insert(rows);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}

/**
 * Closes a motion: sets status to 'passed' or 'failed', records quorum_met
 * and closed_at timestamp.
 *
 * @param motionId  - UUID of the motion to close
 * @param passed    - true if the motion passed, false if it failed
 * @param quorumMet - Whether quorum was present when the vote was taken
 */
export async function closeMotion(
  motionId: string,
  passed: boolean,
  quorumMet: boolean
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("motions")
    .update({
      status: (passed ? "passed" : "failed") satisfies MotionStatus,
      quorum_met: quorumMet,
      closed_at: new Date().toISOString(),
    })
    .eq("id", motionId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}
