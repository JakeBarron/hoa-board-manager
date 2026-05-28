import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PositionName } from "@/types/database";

const POSITION_LABELS: Record<PositionName, string> = {
  president:  "President",
  vp:         "Vice President",
  treasurer:  "Treasurer",
  pool:       "Pool",
  membership: "Membership",
  tennis:     "Tennis",
  social:     "Social",
};

interface TodosPageProps {
  params: Promise<{ position: string }>;
}

export default async function TodosPage({ params }: TodosPageProps) {
  const { position } = await params;
  const label = POSITION_LABELS[position as PositionName] ?? position;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} — To-Do List`}
        action={
          <Button variant="outline" render={<Link href={`/board/${position}`} />}>Back</Button>
        }
      />
      <EmptyState
        title="No todos yet"
        description="Add tasks to keep track of what needs to be done."
      />
    </div>
  );
}
