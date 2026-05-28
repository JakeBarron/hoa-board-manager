import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * Must be called inside an async server context — it awaits the cookie store.
 *
 * Uses the anon key; RLS policies on the database enforce authorization.
 * Never use the service role key here unless bypassing RLS is intentional.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from Server Components where setting cookies
            // is not allowed. The middleware handles session refresh, so
            // this error is safe to swallow.
          }
        },
      },
    }
  );
}
