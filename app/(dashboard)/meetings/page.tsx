import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { getUpcomingMeetingDates } from "@/lib/dates";
import { MeetingListClient } from "./MeetingListClient";
import type { Meeting } from "@/types/database";

export const metadata = { title: "Meetings — HOA Board" };

/**
 * Board meeting calendar.
 * Fetches all required data server-side and delegates rendering + modal state
 * to MeetingListClient. Officers and president see the "Start Meeting" button.
 */
export default async function MeetingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  const [positionResult, allPositionsResult, upcomingResult, pastResult, existingResult, settingsResult] =
    await Promise.all([
      supabase
        .from("positions")
        .select("id, name, role")
        .eq("email", user.email!)
        .single(),
      supabase
        .from("positions")
        .select("id, name, role, is_voting_member, display_name")
        .order("name", { ascending: true }),
      supabase
        .from("meetings")
        .select("id, meeting_date, status")
        .gte("meeting_date", today)
        .neq("status", "adjourned")
        .order("meeting_date", { ascending: true }),
      supabase
        .from("meetings")
        .select("id, meeting_date, status")
        .or(`meeting_date.lt.${today},status.eq.adjourned`)
        .order("meeting_date", { ascending: false })
        .limit(12),
      supabase
        .from("meetings")
        .select("id, status")
        .eq("meeting_date", today)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["hoa_name", "drive_folder_url", "meeting_cadence"]),
    ]);

  const position = positionResult.data;
  if (!position) redirect("/login");
  if (isChair(position.role)) redirect(`/committee/${position.name}`);

  const canSchedule = canEditAll(position.role);
  const canRun = canEditAll(position.role);

  const allPositions = (allPositionsResult.data ?? []).filter(
    (p) => p.role !== "chair"
  ) as Array<{
    id: string;
    name: string;
    role: string;
    is_voting_member: boolean;
    display_name: string | null;
  }>;

  const upcoming = (upcomingResult.data ?? []) as Pick<
    Meeting,
    "id" | "meeting_date" | "status"
  >[];
  const past = (pastResult.data ?? []) as Pick<
    Meeting,
    "id" | "meeting_date" | "status"
  >[];

  const existingMeeting = existingResult.data
    ? {
        id: existingResult.data.id,
        status: existingResult.data.status as "pending" | "in_progress",
      }
    : null;

  const settingsMap = new Map(
    (settingsResult.data ?? []).map((s) => [s.key, s.value])
  );
  const hoaName = settingsMap.get("hoa_name");
  const driveFolder = settingsMap.get("drive_folder_url");

  const cadence = settingsMap.get("meeting_cadence") ?? "";
  const bookedDates = new Set(upcoming.map((m) => m.meeting_date));
  const candidateDates = getUpcomingMeetingDates(cadence, 6);
  const defaultScheduleDate =
    candidateDates.find((d) => !bookedDates.has(d)) ??
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  return (
    <MeetingListClient
      canRun={canRun}
      canSchedule={canSchedule}
      positions={allPositions}
      currentPositionId={position.id}
      existingMeeting={existingMeeting}
      upcoming={upcoming}
      past={past}
      hoaName={hoaName}
      driveFolder={driveFolder}
      defaultScheduleDate={defaultScheduleDate}
    />
  );
}
