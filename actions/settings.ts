"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Updates a single configurable setting by key.
 * Only the president can write settings — enforced by both RLS and an
 * explicit role check here so the error is surfaced clearly.
 *
 * @param key   - The setting key (e.g. "quorum_required")
 * @param value - The new value string
 * @returns An error message string on failure, undefined on success
 */
export async function updateSetting(
  key: string,
  value: string
): Promise<string | undefined> {
  if (!value.trim()) return "Value cannot be empty.";

  const supabase = await createClient();

  const { data: position } = await supabase
    .from("positions")
    .select("role")
    .eq("email", (await supabase.auth.getUser()).data.user?.email ?? "")
    .single();

  if (position?.role !== "president") return "Only the president can change settings.";

  const { error } = await supabase
    .from("settings")
    .update({ value: value.trim() })
    .eq("key", key);

  if (error) return error.message;

  revalidatePath("/admin/settings");
}
