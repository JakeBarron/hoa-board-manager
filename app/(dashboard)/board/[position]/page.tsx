import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PositionName } from "@/types/database";

/** Maps position slug to a human-readable label */
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

interface BoardPositionPageProps {
  params: Promise<{ position: string }>;
}

export default async function BoardPositionPage({ params }: BoardPositionPageProps) {
  const { position } = await params;
  const label = POSITION_LABELS[position as PositionName] ?? position;

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
            <Button size="sm" variant="outline" render={<Link href={`/board/${position}/minutes`} />}>View all</Button>
          }
        >
          <EmptyState title="No minutes yet" />
        </SectionCard>

        <SectionCard
          title="To-Do List"
          headerAction={
            <Button size="sm" variant="outline" render={<Link href={`/board/${position}/todos`} />}>View all</Button>
          }
        >
          <EmptyState title="No todos yet" />
        </SectionCard>
      </div>
    </div>
  );
}
