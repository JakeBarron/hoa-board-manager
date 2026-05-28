import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/hoa/Sidebar";
import type { Position } from "@/types/database";

/**
 * Authenticated dashboard layout.
 * Fetches the current user's position from the DB and renders the sidebar.
 * Redirects to /login if the session or position cannot be resolved.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // getUser() contacts the Auth server — safe for authorization decisions
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolve the board position for this email
  const { data: position } = await supabase
    .from("positions")
    .select("*")
    .eq("email", user.email!)
    .single();

  if (!position) {
    // User has a valid auth session but no matching position row —
    // this shouldn't happen in normal operation, but handle it gracefully
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar position={position as Position} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-6">
        {children}
      </main>
    </div>
  );
}
