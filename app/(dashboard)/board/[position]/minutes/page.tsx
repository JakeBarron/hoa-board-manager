import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { MeetingMinutes, PositionName } from "@/types/database";

import { POSITION_LABELS } from "@/lib/positions";

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social" | "grounds"
>;

interface Props {
  params: Promise<{ position: string }>;
}

/**
 * Lists all meeting minutes for a board position, newest first.
 * Each row shows the date, a Drive link if one has been saved, and an export link.
 * "Add minutes" button is shown only when the current user has edit rights.
 */
export default async function MinutesPage({ params }: Props) {
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

  const { data: minutes } = await supabase
    .from("meeting_minutes")
    .select("id, meeting_date, google_doc_url, content")
    .eq("position_id", targetPosition.id)
    .order("meeting_date", { ascending: false });

  const label = POSITION_LABELS[position as BoardPositionName] ?? position;
  const editable = canEditSection(
    currentPosition.name as PositionName,
    targetPosition.name as PositionName,
    currentPosition.role
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} — Meeting Minutes`}
        subtitle="Board meeting minutes in chronological order."
        action={
          editable ? (
            <Button nativeButton={false} render={<Link href={`/board/${position}/minutes/new`} />}>
              Add minutes
            </Button>
          ) : undefined
        }
      />
      <SectionCard title="Minutes">
        {!minutes || minutes.length === 0 ? (
          <EmptyState
            title="No minutes yet"
            description={
              editable
                ? "Record the first meeting minutes to get started."
                : "No minutes have been recorded for this position."
            }
            action={
              editable ? (
                <Button
                  variant="outline"
                  nativeButton={false} render={<Link href={`/board/${position}/minutes/new`} />}
                >
                  Add minutes
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {(minutes as Pick<MeetingMinutes, "id" | "meeting_date" | "google_doc_url" | "content">[]).map(
              (m) => (
                <li key={m.id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="w-32 shrink-0 font-medium tabular-nums">
                    {new Date(m.meeting_date + "T00:00:00").toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </span>
                  <span className="flex-1 text-muted-foreground">
                    {m.google_doc_url ? (
                      <a
                        href={m.google_doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        View on Google Drive ↗
                      </a>
                    ) : m.content ? (
                      <span className="italic">Draft — not yet on Drive</span>
                    ) : null}
                  </span>
                  {m.content && (
                    <a
                      href={`/api/minutes/${m.id}/export`}
                      className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Export .docx
                    </a>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
