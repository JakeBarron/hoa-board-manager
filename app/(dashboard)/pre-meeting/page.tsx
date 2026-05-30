import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { getUpcomingMeetingDates, formatMeetingDate } from "@/lib/dates";
import type { PositionName } from "@/types/database";

export const metadata = { title: "Pre-Meeting Updates — HOA Board" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Pre-meeting updates aggregate view — officer and president only.
 * Members submit their update from their own position dashboard (/board/[position]).
 * Officers and president use this page to review all submitted updates before
 * preparing the meeting agenda.
 */
export default async function PreMeetingPage({ searchParams }: Props) {
  const { date } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");

  // Chairs redirect to their committee page
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  // Members submit updates from their own position page — redirect them there
  if (!canEditAll(currentPosition.role)) {
    redirect(`/board/${currentPosition.name}`);
  }

  const today = new Date().toISOString().split("T")[0];

  const [scheduledMeetingsResult, cadenceResult] = await Promise.all([
    supabase
      .from("meetings")
      .select("meeting_date")
      .gte("meeting_date", today)
      .in("status", ["pending", "in_progress"])
      .order("meeting_date", { ascending: true })
      .limit(3),
    supabase.from("settings").select("value").eq("key", "meeting_cadence").single(),
  ]);

  const cadence = cadenceResult.data?.value ?? "3:2";
  const scheduledDates = (scheduledMeetingsResult.data ?? []).map(
    (m: { meeting_date: string }) => m.meeting_date
  );
  const meetingDates =
    scheduledDates.length > 0 ? scheduledDates : getUpcomingMeetingDates(cadence, 3);
  const selectedDate = date ?? meetingDates[0];

  const [updatesResult, positionsResult] = await Promise.all([
    supabase
      .from("pre_meeting_updates")
      .select("position_id, content, submitted_at")
      .eq("meeting_date", selectedDate)
      .order("submitted_at"),
    supabase
      .from("positions")
      .select("id, name")
      .in("role", ["president", "officer", "member"]),
  ]);

  const positions = positionsResult.data ?? [];
  const allUpdates = (updatesResult.data ?? []).map((u) => ({
    positionName: positions.find((p) => p.id === u.position_id)?.name ?? "Unknown",
    content: u.content,
    submittedAt: u.submitted_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Meeting Updates"
        subtitle="Review all submitted position updates before the meeting."
      />

      {/* Date tabs */}
      <div className="flex gap-2">
        {meetingDates.map((d) => (
          <a
            key={d}
            href={`/pre-meeting?date=${d}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              d === selectedDate
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {formatMeetingDate(d)}
          </a>
        ))}
      </div>

      <SectionCard
        title={`Submissions — ${formatMeetingDate(selectedDate)}`}
        description={
          allUpdates.length === 0
            ? "No updates submitted yet."
            : `${allUpdates.length} of 8 positions submitted`
        }
      >
        {allUpdates.length === 0 ? (
          <EmptyState
            title="No updates yet"
            description="Board members submit updates from their position dashboard."
          />
        ) : (
          <ul className="divide-y divide-border">
            {allUpdates.map((u) => (
              <li key={u.positionName} className="space-y-1 py-4">
                <p className="text-sm font-medium capitalize">{u.positionName}</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {u.content}
                </p>
                <p className="text-xs text-muted-foreground">
                  Submitted{" "}
                  {new Date(u.submittedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
