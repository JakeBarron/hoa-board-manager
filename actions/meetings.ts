"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MeetingStatus, PositionName } from "@/types/database";
import { formatPersonName } from "@/lib/positions";
import { pickNextMeetingDate } from "@/lib/dates";
import {
  buildMeetingScaffold,
  BOARD_POSITION_ORDER,
  COMMITTEE_POSITION_ORDER,
  type NewBusinessItem,
  type ScaffoldReport,
} from "@/lib/agenda";

/**
 * Schedules a new board meeting in 'pending' status at the end of the queue.
 * Meetings form a sequential, append-only queue: the new date must be strictly
 * after every meeting already scheduled (and not in the past), so date order
 * always equals queue order and the earliest pending/in_progress meeting is
 * unambiguously "next". RLS enforces that only officers and president can insert.
 *
 * @param positionId  - UUID of the board position calling the meeting
 * @param meetingDate - ISO date string (YYYY-MM-DD) in America/New_York timezone; must be today or later, and after the last scheduled meeting
 * @returns The newly created meeting row ID
 */
export async function createMeeting(
  positionId: string,
  meetingDate: string
): Promise<{ id: string }> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  // Both meetingDate and today are YYYY-MM-DD strings — lexicographic comparison is correct for ISO dates
  if (meetingDate < today) throw new Error("Date must be in the future");

  const supabase = await createClient();

  // Append-only: reject anything that wouldn't sit at the end of the queue.
  const { data: latest, error: latestError } = await supabase
    .from("meetings")
    .select("meeting_date")
    .in("status", ["pending", "in_progress"] as MeetingStatus[])
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);
  if (latest && meetingDate <= latest.meeting_date) {
    throw new Error("New meetings must be scheduled after the last scheduled meeting");
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({ meeting_date: meetingDate, called_by: positionId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { id: data.id };
}

/**
 * Calls the meeting to order: records proposer/seconder, sets started_at to
 * now, moves status to in_progress, and saves the initial attendance list.
 * Enforces the queue invariant — the earliest scheduled meeting must be started
 * first, and only one meeting may be in progress at a time.
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

  // Meetings clear in order: the earliest scheduled (pending/in_progress) meeting
  // is the only one that may be started. This also blocks starting a second
  // meeting while another is already in progress.
  const { data: earliest, error: earliestError } = await supabase
    .from("meetings")
    .select("id, status")
    .in("status", ["pending", "in_progress"] as MeetingStatus[])
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (earliestError) throw new Error(earliestError.message);
  if (earliest && earliest.id !== meetingId) {
    throw new Error(
      earliest.status === "in_progress"
        ? "Another meeting is already in progress"
        : "An earlier meeting must be started first"
    );
  }

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
 * Builds the initial minutes scaffold for a meeting and persists it as the
 * meeting's minutes_content, returning the HTML so the runner can seed its
 * editor. The scaffold lays out the standard meeting order with every
 * pre-meeting update (keyed to this meeting) folded inline, plus any new
 * business the runner entered, so a first-time runner can follow along.
 *
 * Idempotent: if the meeting already has minutes content (e.g. resuming an
 * in-progress meeting), the existing content is returned untouched and no new
 * business is applied. Must be called after callToOrder so attendance and the
 * caller/seconder are recorded.
 *
 * @param meetingId   - UUID of the meeting being started
 * @param newBusiness - New-business items the runner entered before call to order
 * @returns The minutes HTML to seed the editor with
 */
export async function seedMeetingScaffold(
  meetingId: string,
  newBusiness: NewBusinessItem[]
): Promise<{ scaffold: string }> {
  const supabase = await createClient();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("called_by, seconded_by, present_positions, minutes_content")
    .eq("id", meetingId)
    .single();

  if (meetingError) throw new Error(meetingError.message);

  // Idempotent: never clobber minutes that already exist (resume case).
  if (meeting.minutes_content && meeting.minutes_content.trim().length > 0) {
    return { scaffold: meeting.minutes_content };
  }

  const [positionsResult, updatesResult, priorMinutesResult, quorumResult] = await Promise.all([
    supabase.from("positions").select("id, name, display_name"),
    supabase.from("pre_meeting_updates").select("position_id, content").eq("meeting_id", meetingId),
    supabase
      .from("meeting_minutes")
      .select("meeting_date, google_doc_url")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "quorum_required").single(),
  ]);

  const positions = (positionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    display_name: string | null;
  }[];
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const positionByName = new Map(positions.map((p) => [p.name, p]));

  const updateByPositionId = new Map(
    (updatesResult.data ?? []).map((u) => [u.position_id, u.content as string])
  );

  /** Formats a position id into its display name, or "Unknown" if missing. */
  const nameOf = (id: string | null): string => {
    if (!id) return "Unknown";
    const pos = positionById.get(id);
    return pos ? formatPersonName(pos.name, pos.display_name) : "Unknown";
  };

  /** Builds ordered report lines for a set of position names. */
  const buildReports = (order: PositionName[]): ScaffoldReport[] =>
    order.map((name) => {
      const pos = positionByName.get(name);
      return {
        label: pos ? formatPersonName(pos.name, pos.display_name) : name,
        content: pos ? (updateByPositionId.get(pos.id) ?? null) : null,
      };
    });

  const presentIds = (meeting.present_positions ?? []) as string[];
  const quorumRequired = quorumResult.data ? parseInt(quorumResult.data.value, 10) : 5;

  const priorMinutes = priorMinutesResult.data
    ? { date: priorMinutesResult.data.meeting_date, url: priorMinutesResult.data.google_doc_url }
    : null;

  const scaffold = buildMeetingScaffold({
    calledByName: nameOf(meeting.called_by),
    secondedByName: nameOf(meeting.seconded_by),
    presentNames: presentIds.map(nameOf),
    quorumMet: presentIds.length >= quorumRequired,
    priorMinutes,
    boardReports: buildReports(BOARD_POSITION_ORDER),
    committeeReports: buildReports(COMMITTEE_POSITION_ORDER),
    newBusiness,
  });

  const { error: saveError } = await supabase
    .from("meetings")
    .update({ minutes_content: scaffold })
    .eq("id", meetingId);

  if (saveError) throw new Error(saveError.message);
  return { scaffold };
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
 * Hard-deletes a meeting and all related records (motions, votes, documents,
 * action items). Only meetings in 'pending' status can be cancelled — meetings
 * that are in_progress or adjourned are rejected. On-delete-cascade in the DB
 * handles child record cleanup automatically.
 *
 * @param meetingId - UUID of the meeting to permanently delete
 * @throws If the meeting does not exist or is not in 'pending' status
 */
export async function cancelMeeting(meetingId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId)
    .eq("status", "pending" satisfies MeetingStatus)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Meeting is not in a cancellable state");

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Moves a pending meeting to a new date while preserving queue order. Validates that:
 * 1. `newDate` is a parseable date string in YYYY-MM-DD format
 * 2. `newDate` is strictly in the future (not today or earlier)
 * 3. No other pending or in_progress meeting is already scheduled on `newDate`
 * 4. `newDate` keeps the meeting in its current slot — strictly after the previous
 *    scheduled meeting and strictly before the next — so the "next" meeting everyone
 *    targets never silently changes
 * 5. The meeting being rescheduled is still in 'pending' status (race condition guard)
 *
 * Revalidates /meetings, /dashboard, and the board/committee sections after a successful update.
 *
 * @param meetingId - UUID of the meeting to reschedule
 * @param newDate   - New ISO date string (YYYY-MM-DD) for the meeting
 * @throws If validation fails, a conflict exists, the move reorders the queue, or the meeting is no longer pending
 */
export async function rescheduleMeeting(
  meetingId: string,
  newDate: string
): Promise<void> {
  const parsed = new Date(newDate + "T00:00:00");
  if (isNaN(parsed.getTime())) throw new Error("Invalid date");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  if (newDate <= today) throw new Error("Date must be in the future");

  const supabase = await createClient();

  const { data: scheduled, error: scheduledError } = await supabase
    .from("meetings")
    .select("id, meeting_date")
    .in("status", ["pending", "in_progress"] as MeetingStatus[]);

  if (scheduledError) throw new Error(scheduledError.message);

  const all = (scheduled ?? []) as { id: string; meeting_date: string }[];
  const thisMeeting = all.find((m) => m.id === meetingId);
  if (!thisMeeting) throw new Error("Meeting is not in a reschedulable state");

  const others = all.filter((m) => m.id !== meetingId);
  if (others.some((m) => m.meeting_date === newDate)) {
    throw new Error("A meeting is already scheduled for that date");
  }

  // Keep the meeting between its current neighbours so queue order (and which
  // meeting is "next") is preserved.
  const prevDate = others
    .filter((m) => m.meeting_date < thisMeeting.meeting_date)
    .reduce<string | null>((max, m) => (max === null || m.meeting_date > max ? m.meeting_date : max), null);
  const nextDate = others
    .filter((m) => m.meeting_date > thisMeeting.meeting_date)
    .reduce<string | null>((min, m) => (min === null || m.meeting_date < min ? m.meeting_date : min), null);

  if (prevDate !== null && newDate <= prevDate) {
    throw new Error("Cannot move a meeting before an earlier scheduled meeting");
  }
  if (nextDate !== null && newDate >= nextDate) {
    throw new Error("Cannot move a meeting after a later scheduled meeting");
  }

  const { data, error } = await supabase
    .from("meetings")
    .update({ meeting_date: newDate })
    .eq("id", meetingId)
    .eq("status", "pending" satisfies MeetingStatus)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Meeting is not in a reschedulable state");

  revalidatePath("/meetings", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/board", "layout");
  revalidatePath("/committee", "layout");
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
 * Best-effort scheduling of the next meeting once one adjourns, keeping the
 * queue from emptying in normal operation. Only acts when no other pending
 * meeting remains; uses the configured cadence (defaulting to the 3rd Tuesday)
 * and the America/New_York date, choosing the first cadence date strictly after
 * both today and the adjourned meeting. Any failure is swallowed so adjournment
 * still succeeds. The DB's one-pending-per-date index guards against races.
 *
 * @param afterDate - The adjourned meeting's date (YYYY-MM-DD)
 * @param calledBy  - Position id to record as caller of the auto-scheduled meeting
 */
async function autoScheduleNextMeeting(afterDate: string, calledBy: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: pending } = await supabase
      .from("meetings")
      .select("id")
      .eq("status", "pending" satisfies MeetingStatus)
      .limit(1)
      .maybeSingle();
    if (pending) return; // the queue already has a next meeting

    const { data: cadenceSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "meeting_cadence")
      .maybeSingle();
    const cadence = cadenceSetting?.value || "3:2";

    const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const nextDate = pickNextMeetingDate(cadence, afterDate, todayET);
    if (!nextDate) return;

    await supabase.from("meetings").insert({ meeting_date: nextDate, called_by: calledBy });
  } catch {
    // best-effort: never block adjournment on a scheduling failure
  }
}

/**
 * Formally adjourns the meeting: sets adjourned_at to now, moves status to adjourned,
 * and auto-uploads the minutes as a .docx to Supabase Storage at minutes/{meetingId}.docx.
 * Then best-effort schedules the next meeting if the queue is now empty.
 * The proposedBy/secondedBy params capture who moved and seconded for the UI flow
 * but are not persisted (schema has no separate adjournment columns).
 *
 * @param meetingId   - UUID of the meeting to adjourn
 * @param proposedBy  - Position ID of the member who moved to adjourn (recorded as the next meeting's caller; not otherwise persisted)
 * @param _secondedBy - Position ID of the member who seconded adjournment (UI only)
 */
export async function adjournMeeting(
  meetingId: string,
  proposedBy?: string,
  _secondedBy?: string
): Promise<{ uploadError: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({
      status: "adjourned" satisfies MeetingStatus,
      adjourned_at: new Date().toISOString(),
    })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);

  const { data: meeting } = await supabase
    .from("meetings")
    .select("meeting_date, called_by, minutes_content")
    .eq("id", meetingId)
    .single();

  // Refill the queue if this was the last scheduled meeting.
  if (meeting) {
    await autoScheduleNextMeeting(meeting.meeting_date, proposedBy ?? meeting.called_by);
  }

  if (!meeting?.minutes_content) {
    revalidatePath("/meetings", "layout");
    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return { uploadError: null };
  }

  const { generateDocx } = await import("@/lib/docx");
  const buffer = await generateDocx(meeting.minutes_content);
  const storagePath = `minutes/${meetingId}.docx`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (uploadError) {
    revalidatePath("/meetings", "layout");
    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return { uploadError: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("meetings")
    .update({ storage_path: storagePath })
    .eq("id", meetingId);

  revalidatePath("/meetings", "layout");
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
  return { uploadError: updateError?.message ?? null };
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
 * Adds a document (primary minutes or amendment) to a meeting.
 * Accepts either a Supabase Storage path or a legacy Google Drive URL.
 * Stores the document in meeting_documents for reference alongside the meeting.
 *
 * @param meetingId       - UUID of the meeting this document belongs to
 * @param name            - Human-readable document name
 * @param storagePath     - Supabase Storage path (preferred for new records)
 * @param docType         - 'minutes' for primary minutes, 'amendment' for amendments
 * @param amendmentNumber - Required when docType is 'amendment'; sequential amendment number
 * @param driveUrl        - Legacy Google Drive URL (only for backward-compat imports)
 * @returns The newly created document row ID
 */
export async function addMeetingDocument(
  meetingId: string,
  name: string,
  storagePath: string,
  docType: "minutes" | "amendment",
  amendmentNumber?: number,
  driveUrl?: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meeting_documents")
    .insert({
      meeting_id: meetingId,
      name,
      storage_path: storagePath || null,
      drive_url: driveUrl ?? null,
      doc_type: docType,
      amendment_number: amendmentNumber ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/meetings");
  return { id: data.id };
}

/**
 * Records that a pre-meeting reminder email was sent for the given meeting.
 * Sets reminder_sent_at to now — used to show a warning on the meeting prep
 * view so the secretary doesn't send the reminder multiple times.
 *
 * @param meetingId - UUID of the meeting for which the reminder was sent
 */
export async function recordReminderSent(meetingId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", meetingId);

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}
