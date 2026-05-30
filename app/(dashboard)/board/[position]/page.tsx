import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { TodoList } from "@/components/hoa/TodoList";
import { PreMeetingForm } from "@/components/hoa/PreMeetingForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getUpcomingMeetingDates, formatMeetingDate } from "@/lib/dates";
import type { PositionName, Todo } from "@/types/database";

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social"
>;

const POSITION_LABELS: Record<BoardPositionName, string> = {
  president:  "President",
  vp:         "Vice President",
  secretary:  "Secretary",
  treasurer:  "Treasurer",
  pool:       "Pool",
  membership: "Membership",
  tennis:     "Tennis",
  social:     "Social",
};

interface Props {
  params: Promise<{ position: string }>;
}

/**
 * Per-position board dashboard.
 * Shows recent todos, a minutes preview, and — when viewing your own page —
 * the pre-meeting update form for the next scheduled meeting.
 */
export default async function BoardPositionPage({ params }: Props) {
  const { position } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [currentPosResult, targetPosResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase.from("positions").select("id, name").eq("name", position as PositionName).single(),
  ]);
  const currentPosition = currentPosResult.data;
  const targetPosition = targetPosResult.data;

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);
  if (!targetPosition) redirect("/dashboard");

  const isOwnPage = currentPosition.id === targetPosition.id;

  // Fetch todos and — if on own page — meeting dates + existing update in parallel
  const today = new Date().toISOString().split("T")[0];

  const [todosResult, scheduledMeetingsResult, cadenceResult] = await Promise.all([
    supabase
      .from("todos")
      .select("*")
      .eq("position_id", targetPosition.id)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(5),
    isOwnPage
      ? supabase
          .from("meetings")
          .select("meeting_date")
          .gte("meeting_date", today)
          .in("status", ["pending", "in_progress"])
          .order("meeting_date", { ascending: true })
          .limit(3)
      : Promise.resolve({ data: null }),
    isOwnPage
      ? supabase.from("settings").select("value").eq("key", "meeting_cadence").single()
      : Promise.resolve({ data: null }),
  ]);

  const todos = todosResult.data;
  const cadence = cadenceResult.data?.value ?? "3:2";
  const scheduledDates = (scheduledMeetingsResult.data ?? []).map(
    (m: { meeting_date: string }) => m.meeting_date
  );
  const meetingDates =
    scheduledDates.length > 0 ? scheduledDates : getUpcomingMeetingDates(cadence, 3);
  const nextMeetingDate = meetingDates[0];

  // Fetch existing pre-meeting update only when on own page
  const existingUpdate = isOwnPage
    ? await supabase
        .from("pre_meeting_updates")
        .select("content")
        .eq("position_id", currentPosition.id)
        .eq("meeting_date", nextMeetingDate)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const label = POSITION_LABELS[position as BoardPositionName] ?? position;
  const editable = canEditSection(
    currentPosition.name as PositionName,
    targetPosition.name as PositionName,
    currentPosition.role
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} Dashboard`}
        subtitle={`Meeting minutes, to-dos, and notes for the ${label} position`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Meeting Minutes"
          headerAction={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/board/${position}/minutes`} />}
            >
              View all
            </Button>
          }
        >
          <EmptyState title="No minutes yet" />
        </SectionCard>

        <SectionCard
          title="To-Do List"
          headerAction={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/board/${position}/todos`} />}
            >
              View all
            </Button>
          }
        >
          <TodoList
            todos={(todos ?? []) as Todo[]}
            positionId={targetPosition.id}
            canEdit={editable}
          />
        </SectionCard>
      </div>

      {isOwnPage && (
        <SectionCard
          title={`Pre-Meeting Update — ${formatMeetingDate(nextMeetingDate)}`}
          description="Submit your status update before the board meeting."
        >
          <PreMeetingForm
            positionId={currentPosition.id}
            selectedDate={nextMeetingDate}
            upcomingMondays={meetingDates}
            existingContent={existingUpdate?.content ?? undefined}
          />
        </SectionCard>
      )}
    </div>
  );
}
