"use server";

import { redirect } from "next/navigation";
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
