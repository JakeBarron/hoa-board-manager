import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMeetingDate } from "@/lib/dates";
import { hasMinutesContent } from "@/lib/minutes";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import type { Meeting } from "@/types/database";

export const metadata = { title: "Minutes — HOA Board" };

/** How many past meetings the archive lists. */
const ARCHIVE_LIMIT = 24;

/**
 * Archive of adjourned board meetings whose minutes are on file.
 *
 * This is the entry point that makes minutes readable by everyone on the board,
 * chairs included — chairs are redirected away from `/meetings`, so without this
 * list they would have no way to navigate to a minutes page. Read-only, so the
 * only gate is being signed in.
 */
export default async function MinutesArchivePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meetingsResult = await supabase
    .from("meetings")
    .select("id, meeting_date, minutes_content")
    .eq("status", "adjourned")
    .order("meeting_date", { ascending: false })
    .limit(ARCHIVE_LIMIT);

  const meetings = (meetingsResult.data ?? []) as Pick<
    Meeting,
    "id" | "meeting_date" | "minutes_content"
  >[];

  // An adjourned meeting with an empty minutes body has nothing to read, so it
  // is left out rather than shown as a dead link.
  const withMinutes = meetings.filter((m) => hasMinutesContent(m.minutes_content));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minutes"
        subtitle="Approved minutes from past board meetings"
      />

      <SectionCard
        title="Past Meetings"
        description={
          withMinutes.length > 0
            ? `${withMinutes.length} ${withMinutes.length === 1 ? "meeting" : "meetings"} on file`
            : undefined
        }
      >
        {withMinutes.length === 0 ? (
          <EmptyState
            title="No minutes on file yet"
            description="Minutes appear here once a meeting has been adjourned and the secretary has saved them."
          />
        ) : (
          <ul className="divide-y divide-border">
            {withMinutes.map((meeting) => (
              <li key={meeting.id}>
                <Link
                  href={`/meetings/${meeting.id}/minutes`}
                  className="flex items-center justify-between gap-4 px-1 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">
                    {formatMeetingDate(meeting.meeting_date)}
                  </span>
                  <span className="text-muted-foreground">Read minutes →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
