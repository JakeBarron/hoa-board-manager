"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MeetingStatus } from "@/types/database";

/**
 * Schedules a new board meeting in 'pending' status.
 * Security enforced by RLS — any authenticated board member can call a meeting.
 *
 * @param positionId  - UUID of the board position calling the meeting
 * @param meetingDate - ISO date string (YYYY-MM-DD)
 * @returns The newly created meeting row ID
 */
export async function createMeeting(
  positionId: string,
  meetingDate: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .insert({ meeting_date: meetingDate, called_by: positionId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { id: data.id };
}

/**
 * Finds an existing in-progress or pending meeting to resume,
 * or creates a new pending meeting for today if none exists.
 * Enforces one-open-meeting-at-a-time rule: returns the first
 * in_progress meeting if any, then falls back to a pending meeting
 * scheduled for today, then creates a fresh pending meeting.
 *
 * @param positionId - UUID of the board position starting/resuming the meeting
 * @returns The meeting id and its current status
 */
export async function startOrResumeMeeting(
  positionId: string
): Promise<{ id: string; status: "pending" | "in_progress" }> {
  const supabase = await createClient();

  const inProgressResult = await supabase
    .from("meetings")
    .select("id, status")
    .eq("status", "in_progress" as MeetingStatus)
    .limit(1)
    .maybeSingle();

  if (inProgressResult.error) throw new Error(inProgressResult.error.message);
  if (inProgressResult.data) {
    return { id: inProgressResult.data.id, status: "in_progress" };
  }

  const today = new Date().toISOString().slice(0, 10);

  const pendingResult = await supabase
    .from("meetings")
    .select("id, status")
    .eq("status", "pending" as MeetingStatus)
    .eq("meeting_date", today)
    .limit(1)
    .maybeSingle();

  if (pendingResult.error) throw new Error(pendingResult.error.message);
  if (pendingResult.data) {
    return { id: pendingResult.data.id, status: "pending" };
  }

  const insertResult = await supabase
    .from("meetings")
    .insert({ meeting_date: today, called_by: positionId })
    .select("id")
    .single();

  if (insertResult.error) throw new Error(insertResult.error.message);

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { id: insertResult.data.id, status: "pending" };
}

/**
 * Calls the meeting to order: records proposer/seconder, sets started_at to
 * now, moves status to in_progress, and saves the initial attendance list.
 *
 * @param meetingId          - UUID of the meeting to call to order
 * @param calledBy           - Position ID of the member calling the meeting to order
 * @param secondedBy         - Position ID of the member seconding
 * @param presentPositionIds - Array of position UUIDs present at call to order
 */
export async function callToOrder(
  meetingId: string,
  calledBy: string,
  secondedBy: string,
  presentPositionIds: string[]
): Promise<void> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("meetings")
    .update({
      called_by: calledBy,
      seconded_by: secondedBy,
      seconded_at: now,
      started_at: now,
      status: "in_progress" satisfies MeetingStatus,
      present_positions: presentPositionIds,
    })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Updates which positions are currently marked present. Called during the
 * attendance step and any time attendance changes on the fly during the meeting.
 *
 * @param meetingId          - UUID of the meeting to update
 * @param presentPositionIds - Full replacement list of currently present position UUIDs
 */
export async function updateAttendance(
  meetingId: string,
  presentPositionIds: string[]
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({ present_positions: presentPositionIds })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}

/**
 * Hard-deletes the meeting and all related records (motions, votes, documents,
 * action items). Used for cancel flow. On-delete-cascade in the DB handles
 * child record cleanup automatically.
 *
 * @param meetingId - UUID of the meeting to permanently delete
 */
export async function cancelMeeting(meetingId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Overwrites the live minutes HTML content. Called on every meaningful action
 * during the meeting so minutes stay current if the page is refreshed.
 *
 * @param meetingId - UUID of the meeting whose minutes to update
 * @param content   - Full HTML string of the current minutes document
 */
export async function saveMeetingMinutes(
  meetingId: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({ minutes_content: content })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}

/**
 * Formally adjourns the meeting: sets adjourned_at to now and moves status to adjourned.
 * The proposedBy/secondedBy params capture who moved and seconded for the UI flow
 * but are not persisted (schema has no separate adjournment columns).
 *
 * @param meetingId  - UUID of the meeting to adjourn
 * @param _proposedBy - Position ID of the member who moved to adjourn (UI only)
 * @param _secondedBy - Position ID of the member who seconded adjournment (UI only)
 */
export async function adjournMeeting(
  meetingId: string,
  _proposedBy?: string,
  _secondedBy?: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({
      status: "adjourned" satisfies MeetingStatus,
      adjourned_at: new Date().toISOString(),
    })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Saves the Google Drive URL for the exported minutes document.
 *
 * @param meetingId - UUID of the meeting
 * @param driveUrl  - Full Google Drive share URL for the exported minutes
 */
export async function saveMeetingDriveUrl(
  meetingId: string,
  driveUrl: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({ minutes_drive_url: driveUrl })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
}

/**
 * Adds a Drive document link (primary minutes or amendment) to a meeting.
 * Stores the document in meeting_documents for reference alongside the meeting.
 *
 * @param meetingId       - UUID of the meeting this document belongs to
 * @param name            - Human-readable document name
 * @param driveUrl        - Full Google Drive share URL
 * @param docType         - 'minutes' for primary minutes, 'amendment' for amendments
 * @param amendmentNumber - Required when docType is 'amendment'; sequential amendment number
 * @returns The newly created document row ID
 */
export async function addMeetingDocument(
  meetingId: string,
  name: string,
  driveUrl: string,
  docType: "minutes" | "amendment",
  amendmentNumber?: number
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting_documents")
    .insert({
      meeting_id: meetingId,
      name,
      drive_url: driveUrl,
      doc_type: docType,
      amendment_number: amendmentNumber ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  return { id: data.id };
}
