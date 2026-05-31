import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles auth redirects from Supabase. Supports two flows:
 * - PKCE (code param): exchanges a PKCE authorization code for a session
 * - Email OTP (token_hash + type): verifies a one-time password token
 *
 * On success: redirects to /update-password (session cookie is now set).
 * On failure: redirects to /login?error=... with a human-readable message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/update-password`);
    }
  } else if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}/update-password`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Link+expired+or+invalid.+Please+request+a+new+one.`
  );
}
