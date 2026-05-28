import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { PreMeetingForm } from "@/components/hoa/PreMeetingForm";
import { getUpcomingMondays, formatMeetingDate } from "@/lib/dates";
import type { PositionName } from "@/types/database";

export const metadata = { title: "Pre-Meeting Update — HOA Board" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Pre-meeting status update page.
 * Each board member submits their monthly update ahead of the meeting.
 * Officers and president also see all submitted updates for the selected date
 * so they can prepare the agenda.
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

  const upcomingMondays = getUpcomingMondays(3);
  const selectedDate = date ?? upcomingMondays[0];

  // Fetch the current user's existing update for the selected date (if any)
  const { data: existingUpdate } = await supabase
    .from("pre_meeting_updates")
    .select("content")
    .eq("position_id", currentPosition.id)
    .eq("meeting_date", selectedDate)
    .maybeSingle();

  // Officers and president see all submitted updates for the date
  const isOfficerOrAbove = canEditAll(currentPosition.role);
  let allUpdates: { positionName: string; content: string; submittedAt: string }[] = [];

  if (isOfficerOrAbove) {
    const [updatesResult, positionsResult] = await Promise.all([
      supabase
        .from("pre_meeting_updates")
        .select("position_id, content, submitted_at")
        .eq("meeting_date", selectedDate)
        .order("submitted_at"),
      supabase.from("positions").select("id, name"),
    ]);

    const positions = positionsResult.data ?? [];
    allUpdates = (updatesResult.data ?? []).map((u) => ({
      positionName:
        positions.find((p) => p.id === u.position_id)?.name ?? "Unknown",
      content: u.content,
      submittedAt: u.submitted_at,
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Meeting Status Update"
        subtitle="Submit your update before the monthly board meeting."
      />

      <SectionCard title="Your Update">
        <PreMeetingForm
          positionId={currentPosition.id}
          selectedDate={selectedDate}
          upcomingMondays={upcomingMondays}
          existingContent={existingUpdate?.content ?? undefined}
        />
      </SectionCard>

      {isOfficerOrAbove && (
        <SectionCard
          title={`All Submitted Updates — ${formatMeetingDate(selectedDate)}`}
          description={
            allUpdates.length === 0
              ? "No updates submitted yet."
              : `${allUpdates.length} of 8 positions submitted`
          }
        >
          {allUpdates.length > 0 && (
            <ul className="divide-y divide-border">
              {allUpdates.map((u) => (
                <li key={u.positionName} className="py-4 space-y-1">
                  <p className="text-sm font-medium capitalize">{u.positionName}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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
      )}
    </div>
  );
}
