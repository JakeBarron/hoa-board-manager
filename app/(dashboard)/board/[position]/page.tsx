import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { TodoList } from "@/components/hoa/TodoList";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PositionName, Todo } from "@/types/database";

const POSITION_LABELS: Record<PositionName, string> = {
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
 * Shows a preview of recent to-dos and a stub for meeting minutes.
 * Resolves both the current user's position and the viewed position in parallel.
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
  if (!targetPosition) redirect("/dashboard");

  // Fetch the 5 most recent incomplete todos for the preview card
  const { data: todos } = await supabase
    .from("todos")
    .select("*")
    .eq("position_id", targetPosition.id)
    .eq("completed", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const label = POSITION_LABELS[position as PositionName] ?? position;
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
              nativeButton={false} render={<Link href={`/board/${position}/minutes`} />}
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
              nativeButton={false} render={<Link href={`/board/${position}/todos`} />}
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
    </div>
  );
}
