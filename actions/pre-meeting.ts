"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Saves or updates a board member's pre-meeting status update for a meeting.
 * Upserts on (position_id, meeting_id) — one update per position per meeting.
 * Updates attach to the specific meeting (not a bare date) so they stay with the
 * meeting even if it is rescheduled. Security enforced by RLS.
 *
 * @param positionId - UUID of the position submitting the update
 * @param meetingId  - UUID of the meeting the update is for
 * @param content    - The status update text
 */
export async function submitPreMeetingUpdate(
  positionId: string,
  meetingId: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("pre_meeting_updates").upsert(
    { position_id: positionId, meeting_id: meetingId, content },
    { onConflict: "position_id,meeting_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/board", "layout");
  revalidatePath("/committee", "layout");
}
