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
import { formatMeetingDate } from "@/lib/dates";
import { canEditAll } from "@/lib/permissions";
import type { PositionName, Todo } from "@/types/database";
import { POSITION_LABELS } from "@/lib/positions";

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social" | "grounds"
>;

interface Props {
  params: Promise<{ position: string }>;
}

/**
 * Per-position board dashboard.
 * Shows recent todos, a minutes preview, and — when viewing your own page —
 * the pre-meeting update form for the single upcoming ("NEXT") meeting.
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

  // Fetch todos and — if on own page — the NEXT meeting in parallel
  const [todosResult, nextMeetingResult] = await Promise.all([
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
          .select("id, meeting_date")
          .in("status", ["pending", "in_progress"])
          .order("meeting_date", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const todos = todosResult.data;
  const nextMeeting = nextMeetingResult.data as { id: string; meeting_date: string } | null;

  // Fetch existing pre-meeting update only when on own page and a meeting exists
  const existingUpdate = isOwnPage && nextMeeting
    ? await supabase
        .from("pre_meeting_updates")
        .select("content")
        .eq("position_id", currentPosition.id)
        .eq("meeting_id", nextMeeting.id)
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
          title={
            nextMeeting
              ? `Pre-Meeting Update — ${formatMeetingDate(nextMeeting.meeting_date)}`
              : "Pre-Meeting Update"
          }
        >
          <PreMeetingForm
            positionId={currentPosition.id}
            meetingId={nextMeeting?.id ?? null}
            existingContent={existingUpdate?.content ?? undefined}
            canSchedule={canEditAll(currentPosition.role)}
          />
        </SectionCard>
      )}
    </div>
  );
}
