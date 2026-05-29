import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { MeetingScheduleForm } from "@/components/hoa/MeetingScheduleForm";

export const metadata = { title: "Schedule Meeting — HOA Board" };

/**
 * Page for scheduling a new board meeting.
 * Access restricted to officers and president (canEditAll).
 * Members are redirected to /meetings.
 */
export default async function NewMeetingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("id, role")
    .eq("email", user.email!)
    .single();

  if (!position) redirect("/login");
  if (!canEditAll(position.role)) redirect("/meetings");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule a Meeting"
        subtitle="Add a new meeting date to the board calendar."
      />
      <SectionCard title="Meeting Details">
        <MeetingScheduleForm positionId={position.id} />
      </SectionCard>
    </div>
  );
}
