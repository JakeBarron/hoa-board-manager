import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase password-reset token for a session, then redirects.
 * Supabase sends the user here after they click a reset link in their email.
 *
 * On success: redirects to /update-password (session cookie is now set).
 * On failure: redirects to /login?error=... with a human-readable message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
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
