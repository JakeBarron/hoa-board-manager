import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CalendarView } from "@/components/hoa/CalendarView";
import { Button } from "@/components/ui/button";
import { canEditAll } from "@/lib/permissions";
import { buildCalendarItems } from "@/lib/calendar/calendar";
import type { PositionRole } from "@/types/database";

export const metadata = { title: "Annual Cycle — HOA Board" };

/**
 * Annual Cycle — board-wide operating calendar, readable by everyone
 * (including committee chairs, so there is no chair redirect here).
 */
export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [posResult, areasResult, eventsResult, occResult] = await Promise.all([
    supabase.from("positions").select("role").eq("email", user.email!).single(),
    supabase.from("responsibility_areas").select("*").order("sort_order"),
    supabase.from("calendar_events").select("*").order("title"),
    supabase.from("event_occurrences").select("*"),
  ]);

  const role = posResult.data?.role as PositionRole | undefined;
  const items = buildCalendarItems(
    areasResult.data ?? [],
    eventsResult.data ?? [],
    occResult.data ?? []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Annual Cycle"
        subtitle="The HOA's recurring annual cycle across all responsibility areas."
        action={
          role && canEditAll(role) ? (
            <Button nativeButton={false} render={<Link href="/calendar/manage" />}>
              Manage
            </Button>
          ) : undefined
        }
      />
      <CalendarView items={items} />
    </div>
  );
}
