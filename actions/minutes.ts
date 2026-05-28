"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Creates a new meeting minutes record for the given board position.
 * Requires either content or a Google Drive URL (enforced at the DB level too).
 * Security enforced by RLS.
 *
 * @param positionId    - UUID of the position that owns these minutes
 * @param meetingDate   - ISO date string (YYYY-MM-DD)
 * @param content       - WYSIWYG HTML content authored in-app
 * @param googleDocUrl  - Optional Google Drive URL (set after export + upload)
 * @returns The newly created minutes row ID
 */
export async function saveMinutes(
  positionId: string,
  meetingDate: string,
  content: string,
  googleDocUrl?: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting_minutes")
    .insert({
      position_id: positionId,
      meeting_date: meetingDate,
      content: content || null,
      google_doc_url: googleDocUrl || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/board", "layout");
  return { id: data.id };
}

/**
 * Updates the Google Drive URL on an existing minutes record.
 * Called after the user exports to DOCX, uploads to Drive, and pastes the link.
 * Security enforced by RLS — only the owning position or officer+ can update.
 *
 * @param minutesId    - UUID of the minutes record to update
 * @param googleDocUrl - The Google Drive URL to store
 */
export async function updateMinutesDriveUrl(
  minutesId: string,
  googleDocUrl: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meeting_minutes")
    .update({ google_doc_url: googleDocUrl })
    .eq("id", minutesId);

  if (error) throw new Error(error.message);
  revalidatePath("/board", "layout");
}
