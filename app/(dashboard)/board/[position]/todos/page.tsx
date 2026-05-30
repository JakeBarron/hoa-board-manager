import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { TodoList } from "@/components/hoa/TodoList";
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
 * Full to-do list for a board position.
 * Incomplete items sort first; within each group, newest first.
 * Add/toggle/delete controls shown only when the current user has edit rights.
 */
export default async function TodosPage({ params }: Props) {
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

  const { data: todos } = await supabase
    .from("todos")
    .select("*")
    .eq("position_id", targetPosition.id)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false });

  const label = POSITION_LABELS[position as BoardPositionName] ?? position;
  const editable = canEditSection(
    currentPosition.name as PositionName,
    targetPosition.name as PositionName,
    currentPosition.role
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} — To-Do List`}
        subtitle={
          editable
            ? "Add, complete, or remove to-dos for this position."
            : "Read-only view."
        }
      />
      <SectionCard title="To-Dos">
        <TodoList
          todos={(todos ?? []) as Todo[]}
          positionId={targetPosition.id}
          canEdit={editable}
        />
      </SectionCard>
    </div>
  );
}
