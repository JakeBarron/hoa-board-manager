"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { canEditAll } from "@/lib/permissions";
import type { PositionRole } from "@/types/database";

/** One occurrence to persist for an event. */
export type OccurrenceInput = { month: number; dayOfMonth: number | null };

/** Fields for creating or updating a calendar event. */
export type EventInput = {
  id?: string;
  areaId: string;
  title: string;
  responsibleParty: string | null;
  notes: string | null;
  templateUrl: string | null;
  occurrences: OccurrenceInput[];
};

/** Fields for creating or updating a responsibility area. */
export type AreaInput = {
  id?: string;
  name: string;
  color: string;
  sortOrder: number;
};

/**
 * Resolves the signed-in user's position and whether they may edit the calendar.
 * Returns the server client alongside so callers reuse one connection.
 */
async function resolveEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: position } = await supabase
    .from("positions")
    .select("id, role")
    .eq("email", user?.email ?? "")
    .single();
  const allowed = !!position && canEditAll(position.role as PositionRole);
  return { supabase, positionId: position?.id ?? null, allowed };
}

/** Revalidates the surfaces that read calendar data. */
function revalidateCalendar(): void {
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
}

/**
 * Creates or updates a responsibility area.
 * Only president/officer (canEditAll). Returns an error message or undefined.
 *
 * @param input - Area fields; include `id` to update, omit to create
 */
export async function saveArea(input: AreaInput): Promise<string | undefined> {
  if (!input.name.trim()) return "Area name is required.";
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return "Color must be a hex value like #0f766e.";

  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const row = {
    name: input.name.trim(),
    color: input.color,
    sort_order: input.sortOrder,
  };
  const { error } = input.id
    ? await supabase.from("responsibility_areas").update(row).eq("id", input.id)
    : await supabase.from("responsibility_areas").insert(row);

  if (error) return error.message;
  revalidateCalendar();
}

/**
 * Deletes a responsibility area. Blocked if any events still reference it
 * (the FK is `on delete restrict`; this returns a friendly message first).
 *
 * @param id - The area id
 */
export async function deleteArea(id: string): Promise<string | undefined> {
  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const { count } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("area_id", id);
  if ((count ?? 0) > 0) return "Reassign or delete this area's events before deleting it.";

  const { error } = await supabase.from("responsibility_areas").delete().eq("id", id);
  if (error) return error.message;
  revalidateCalendar();
}

/**
 * Creates or updates an event together with its occurrences (replace-all).
 * Only president/officer (canEditAll). Returns an error message or undefined.
 *
 * @param input - Event fields + the full set of occurrences
 */
export async function saveEvent(input: EventInput): Promise<string | undefined> {
  if (!input.title.trim()) return "Title is required.";
  if (!input.areaId) return "An area is required.";
  if (input.occurrences.length === 0) return "Add at least one month.";

  const { supabase, positionId, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const fields = {
    area_id: input.areaId,
    title: input.title.trim(),
    responsible_party: input.responsibleParty,
    notes: input.notes,
    template_url: input.templateUrl,
  };

  let eventId = input.id;
  if (eventId) {
    const { error } = await supabase
      .from("calendar_events")
      .update({ ...fields, updated_by_position_id: positionId, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) return error.message;
    const { error: delErr } = await supabase
      .from("event_occurrences")
      .delete()
      .eq("event_id", eventId);
    if (delErr) return delErr.message;
  } else {
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({ ...fields, created_by_position_id: positionId })
      .select("id")
      .single();
    if (error) return error.message;
    eventId = data.id;
  }

  const rows = input.occurrences.map((o) => ({
    event_id: eventId!,
    month: o.month,
    day_of_month: o.dayOfMonth,
  }));
  const { error: occErr } = await supabase.from("event_occurrences").insert(rows);
  if (occErr) return occErr.message;

  revalidateCalendar();
}

/**
 * Deletes an event; its occurrences cascade away.
 *
 * @param id - The event id
 */
export async function deleteEvent(id: string): Promise<string | undefined> {
  const { supabase, allowed } = await resolveEditor();
  if (!allowed) return "Only the president or an officer can edit the calendar.";

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) return error.message;
  revalidateCalendar();
}
