import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { PreMeetingForm } from "@/components/hoa/PreMeetingForm";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatMeetingDate } from "@/lib/dates";
import { canEditAll } from "@/lib/permissions";
import type { PositionName, ArchitectureRequest } from "@/types/database";

type ChairPositionName = "web" | "architecture" | "welcoming" | "clubhouse" | "cra";

const CHAIR_LABELS: Record<ChairPositionName, string> = {
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};

const CHAIR_NAMES = new Set<string>(["web", "architecture", "welcoming", "clubhouse", "cra"]);

interface Props {
  params: Promise<{ chair: string }>;
}

/**
 * Committee chair section page.
 * All chairs get a pre-meeting update widget.
 * The architecture chair additionally sees the architecture requests list.
 *
 * Access rules:
 *   - Chair on their own page: full edit
 *   - President / officer: full edit (same render as chair)
 *   - Voting member: read-only
 *   - Chair on another chair's page: redirect to own page
 */
export default async function CommitteePage({ params }: Props) {
  const { chair } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!CHAIR_NAMES.has(chair)) redirect("/dashboard");

  const [currentPosResult, targetPosResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase.from("positions").select("id, name").eq("name", chair as PositionName).single(),
  ]);

  const currentPosition = currentPosResult.data;
  const targetPosition = targetPosResult.data;

  if (!currentPosition) redirect("/login");
  if (!targetPosition) redirect("/dashboard");

  // Chair visiting another chair's page → redirect to their own
  if (isChair(currentPosition.role) && currentPosition.name !== chair) {
    redirect(`/committee/${currentPosition.name}`);
  }

  const canEdit =
    currentPosition.role === "president" ||
    currentPosition.role === "officer" ||
    currentPosition.id === targetPosition.id;

  const isArchitectureChair = chair === "architecture";

  // Fetch the NEXT meeting whenever canEdit is true so that officers and
  // president can submit on behalf of a chair, not just the chair themselves.
  const [nextMeetingResult, archRequestsResult] = await Promise.all([
    canEdit
      ? supabase
          .from("meetings")
          .select("id, meeting_date")
          .in("status", ["pending", "in_progress"])
          .order("meeting_date", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isArchitectureChair
      ? supabase
          .from("architecture_requests")
          .select("*")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const nextMeeting = nextMeetingResult.data as { id: string; meeting_date: string } | null;

  const existingUpdate = canEdit && nextMeeting
    ? await supabase
        .from("pre_meeting_updates")
        .select("content")
        .eq("position_id", targetPosition.id)
        .eq("meeting_id", nextMeeting.id)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const archRequests = (archRequestsResult.data ?? []) as ArchitectureRequest[];
  const label = CHAIR_LABELS[chair as ChairPositionName] ?? chair;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} Dashboard`}
        subtitle={`Committee section for ${label}`}
      />

      {canEdit && (
        <SectionCard
          title={
            nextMeeting
              ? `Pre-Meeting Update — ${formatMeetingDate(nextMeeting.meeting_date)}`
              : "Pre-Meeting Update"
          }
        >
          <PreMeetingForm
            positionId={targetPosition.id}
            meetingId={nextMeeting?.id ?? null}
            existingContent={existingUpdate?.content ?? undefined}
            canSchedule={canEditAll(currentPosition.role)}
          />
        </SectionCard>
      )}

      {!canEdit && (
        <SectionCard title="Pre-Meeting Update">
          <p className="text-sm text-muted-foreground">
            View only — you cannot edit this section.
          </p>
        </SectionCard>
      )}

      {isArchitectureChair && (
        <SectionCard
          title="Architecture Requests"
          headerAction={
            <Button size="sm" variant="outline" disabled>
              Submit New Request
            </Button>
          }
        >
          {archRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No architecture requests on file.</p>
          ) : (
            <ul className="divide-y divide-border">
              {archRequests.map((req) => (
                <li key={req.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{req.address}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={req.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/architecture/${req.id}`} />}
                    >
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
