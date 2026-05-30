"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the user in with Supabase email/password auth.
 * On success, redirects to the dashboard.
 * On failure, returns an error message string.
 *
 * @param email - The position account email
 * @param password - The position account password
 * @returns An error message string, or redirects on success
 */
export async function signIn(email: string, password: string): Promise<string | never> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Return a safe message — never expose internal Supabase error details
    return "Invalid email or password. Please try again.";
  }

  redirect("/dashboard");
}

/**
 * Signs the current user out and redirects to the login page.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Sends a Supabase password reset email to the given address.
 * Always resolves — never reveals whether the email is registered.
 *
 * @param email - The address to send the reset link to
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "https://board.eastspringlake.com";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });
}

/**
 * Updates the authenticated user's password, signs them out, and redirects to /login.
 * Called from the /update-password page after a successful token exchange.
 *
 * @param password - The new password
 * @returns An error message string if the update fails, otherwise redirects
 */
export async function updatePassword(password: string): Promise<string | never> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.message;
  await supabase.auth.signOut();
  redirect("/login?message=Password+updated.+Sign+in+with+your+new+password.");
}
