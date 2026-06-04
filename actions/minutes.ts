"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Creates a new meeting minutes record for the given board position and
 * auto-uploads the content as a .docx to Supabase Storage.
 * Security enforced by RLS.
 *
 * @param positionId  - UUID of the position that owns these minutes
 * @param meetingDate - ISO date string (YYYY-MM-DD)
 * @param content     - WYSIWYG HTML content authored in-app
 * @returns The newly created minutes row ID
 */
export async function saveMinutes(
  positionId: string,
  meetingDate: string,
  content: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting_minutes")
    .insert({
      position_id: positionId,
      meeting_date: meetingDate,
      content: content || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (content) {
    try {
      const { generateDocx } = await import("@/lib/docx");
      const buffer = await generateDocx(content);
      const storagePath = `minutes/${data.id}.docx`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (!uploadError) {
        await supabase
          .from("meeting_minutes")
          .update({ storage_path: storagePath })
          .eq("id", data.id);
      }
    } catch {
      // Upload failure is non-fatal — content is still saved in the DB
    }
  }

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
