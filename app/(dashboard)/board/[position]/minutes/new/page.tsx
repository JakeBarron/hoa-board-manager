import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { MinutesForm } from "@/components/hoa/MinutesForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PositionName } from "@/types/database";

import { POSITION_LABELS } from "@/lib/positions";

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social" | "grounds"
>;

interface Props {
  params: Promise<{ position: string }>;
}

/**
 * Create new meeting minutes for a board position.
 * Redirects to /login if unauthenticated, to /dashboard if the position
 * does not exist, or back to the minutes list if the user cannot edit.
 */
export default async function NewMinutesPage({ params }: Props) {
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

  const editable = canEditSection(
    currentPosition.name as PositionName,
    targetPosition.name as PositionName,
    currentPosition.role
  );

  if (!editable) redirect(`/board/${position}/minutes`);

  const label = POSITION_LABELS[position as BoardPositionName] ?? position;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} — New Minutes`}
        subtitle="Write the meeting minutes, save, then export to .docx for Google Drive."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={`/board/${position}/minutes`} />}>
            Cancel
          </Button>
        }
      />
      <SectionCard title="Minutes">
        <MinutesForm positionId={targetPosition.id} positionSlug={position} />
      </SectionCard>
    </div>
  );
}
