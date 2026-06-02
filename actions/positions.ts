"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

/**
 * Updates a position's display name and/or email.
 * President-only — enforced by both RLS and an explicit role check.
 *
 * When the email changes:
 *   1. The Supabase auth user's email is updated via the service role client.
 *   2. A password reset email is sent to the new address so the new person
 *      can set their own password.
 *
 * @param id           - The position row UUID
 * @param display_name - The person's real name, or null to clear it
 * @param email        - The new email address for this position
 * @returns An error message string on failure, undefined on success
 */
export async function updatePosition(
  id: string,
  {
    display_name,
    email,
  }: {
    display_name: string | null;
    email: string;
  }
): Promise<string | undefined> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return "Email cannot be empty.";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  // Verify caller is president
  const { data: callerPosition } = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();
  if (callerPosition?.role !== "president")
    return "Only the president can manage positions.";

  // Fetch the current position row so we know the old email
  const { data: currentPosition, error: fetchError } = await supabase
    .from("positions")
    .select("email")
    .eq("id", id)
    .single();
  if (fetchError || !currentPosition) return "Position not found.";

  const oldEmail = currentPosition.email;
  const emailChanged = oldEmail.toLowerCase() !== trimmedEmail;

  // Validate new email isn't already assigned to a different position
  if (emailChanged) {
    const { data: conflict } = await supabase
      .from("positions")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();
    if (conflict && conflict.id !== id) return "That email is already assigned to another position.";
  }

  // Update the positions row
  const { error: updateError } = await supabase
    .from("positions")
    .update({
      display_name: display_name?.trim() || null,
      email: trimmedEmail,
    })
    .eq("id", id);
  if (updateError) return updateError.message;

  // If email changed, update Supabase auth user and send password reset
  if (emailChanged) {
    const serviceClient = createServiceClient();

    // Find the auth user by old email (case-insensitive to match Supabase's storage)
    const { data: usersData, error: listError } =
      await serviceClient.auth.admin.listUsers();
    if (listError) {
      return `Email updated in DB but could not list auth users: ${listError.message}. Update the auth user manually in the Supabase dashboard.`;
    }

    const authUser = usersData?.users.find(
      (u) => u.email?.toLowerCase() === oldEmail.toLowerCase()
    );
    if (!authUser) {
      return `Email updated in DB but no Supabase auth user found for ${oldEmail}. Update the auth user manually in the Supabase dashboard.`;
    }

    const { error: authUpdateError } =
      await serviceClient.auth.admin.updateUserById(authUser.id, {
        email: trimmedEmail,
      });
    if (authUpdateError) {
      return `Email updated in DB but Supabase auth update failed: ${authUpdateError.message}. Update the auth user manually in the Supabase dashboard.`;
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://board.eastspringlake.com";
    const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(
      trimmedEmail,
      { redirectTo: `${siteUrl}/login` }
    );
    if (resetError) {
      return `Email updated but password reset email failed to send: ${resetError.message}. Send a reset manually from the Supabase dashboard.`;
    }
  }

  revalidatePath("/admin/positions", "layout");
}
