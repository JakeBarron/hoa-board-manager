import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CalendarAdmin } from "@/components/hoa/CalendarAdmin";
import type { PositionRole } from "@/types/database";

export const metadata = { title: "Manage Calendar — HOA Board" };

/** Admin CRUD for the operating calendar — president/officer only. */
export default async function ManageCalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!position) redirect("/login");
  if (isChair(position.role)) redirect(`/committee/${position.name}`);
  if (!canEditAll(position.role as PositionRole)) redirect("/dashboard");

  const [areasResult, eventsResult, occResult] = await Promise.all([
    supabase.from("responsibility_areas").select("*").order("sort_order"),
    supabase.from("calendar_events").select("*").order("title"),
    supabase.from("event_occurrences").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/calendar"
        className="inline-block text-sm text-primary hover:underline"
      >
        ← Back to calendar
      </Link>
      <PageHeader
        title="Manage Calendar"
        subtitle="Add, edit, and remove responsibility areas and events."
      />
      <CalendarAdmin
        areas={areasResult.data ?? []}
        events={eventsResult.data ?? []}
        occurrences={occResult.data ?? []}
      />
    </div>
  );
}
