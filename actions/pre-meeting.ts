"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Saves or updates a board member's pre-meeting status update.
 * Upserts on (position_id, meeting_date) — one update per position per meeting.
 * Security enforced by RLS.
 *
 * @param positionId  - UUID of the position submitting the update
 * @param meetingDate - ISO date string (YYYY-MM-DD)
 * @param content     - The status update text
 */
export async function submitPreMeetingUpdate(
  positionId: string,
  meetingDate: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("pre_meeting_updates").upsert(
    { position_id: positionId, meeting_date: meetingDate, content },
    { onConflict: "position_id,meeting_date" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/pre-meeting", "page");
}
