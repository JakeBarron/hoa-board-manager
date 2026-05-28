import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in browser (Client Components, hooks).
 * Reads NEXT_PUBLIC_ env vars at runtime — safe to call on the client.
 *
 * Returns a typed client using the generated Database type so all queries
 * are fully type-checked against the schema.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
