import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";

/**
 * The standalone pre-meeting aggregate page has been folded into the meeting
 * prep view. This route now redirects to the NEXT meeting's prep page (or the
 * meetings list if nothing is scheduled). Members and chairs are sent to their
 * own pages where they submit updates.
 */
export default async function PreMeetingRedirect() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  const { data: nextMeeting } = await supabase
    .from("meetings")
    .select("id")
    .in("status", ["pending", "in_progress"])
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  redirect(nextMeeting ? `/meetings/${nextMeeting.id}` : "/meetings");
}
