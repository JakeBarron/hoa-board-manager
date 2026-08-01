import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { formatMeetingDate } from "@/lib/dates";
import { hasMinutesContent } from "@/lib/minutes";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { MinutesDocument } from "@/components/hoa/MinutesDocument";

export const metadata = { title: "Meeting Minutes — HOA Board" };

/**
 * Read-only view of a single meeting's minutes.
 *
 * Deliberately the most widely readable meeting route in the app: any
 * authenticated position may open it, including committee chairs, who are
 * redirected away from `/meetings` and `/meetings/[id]`. Nothing here is
 * editable, so there is no permission to gate beyond being signed in.
 *
 * The query touches only columns that predate migration 0017 and the .docx is
 * regenerated on demand by `/api/meetings/[id]/export`, so this page does not
 * depend on Supabase Storage being wired up.
 *
 * @param params - Route params containing the meeting UUID as `id`
 */
export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [positionResult, meetingResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase
      .from("meetings")
      .select("id, meeting_date, status, minutes_content, minutes_drive_url")
      .eq("id", id)
      .single(),
  ]);

  const currentPosition = positionResult.data;
  if (!currentPosition) redirect("/login");

  const meeting = meetingResult.data;
  if (!meeting) redirect("/minutes");

  const minutesAvailable = hasMinutesContent(meeting.minutes_content);

  // Chairs cannot reach /meetings, so send them back to the minutes archive instead.
  const backHref = isChair(currentPosition.role) ? "/minutes" : `/meetings/${meeting.id}`;
  const backLabel = isChair(currentPosition.role) ? "← All minutes" : "← Meeting details";

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMeetingDate(meeting.meeting_date)}
        subtitle="Meeting Minutes"
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={meeting.status} />
            <Link
              href={backHref}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {backLabel}
            </Link>
          </div>
        }
      />

      <SectionCard
        title="Minutes"
        headerAction={
          minutesAvailable ? (
            <div className="flex items-center gap-3 text-sm">
              <a
                href={`/api/meetings/${meeting.id}/export`}
                className="text-primary hover:underline"
              >
                Download .docx
              </a>
              {meeting.minutes_drive_url && (
                <a
                  href={meeting.minutes_drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open in Drive
                </a>
              )}
            </div>
          ) : undefined
        }
      >
        <MinutesDocument
          content={meeting.minutes_content}
          emptyDescription={
            meeting.status === "pending"
              ? "This meeting has not been held yet. Minutes appear here once it is adjourned."
              : undefined
          }
        />
      </SectionCard>
    </div>
  );
}
