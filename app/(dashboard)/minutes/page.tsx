import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { formatMeetingDate } from "@/lib/dates";
import { toMinutesArchiveRows } from "@/lib/minutes";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import type { Meeting } from "@/types/database";

export const metadata = { title: "Minutes — HOA Board" };


/**
 * Archive of adjourned board meetings and their minutes.
 *
 * This is the entry point that makes minutes readable by everyone on the board,
 * chairs included — chairs are redirected away from `/meetings`, so without this
 * list they would have no way to navigate to a minutes page. Read-only, so the
 * only gate is being signed in.
 *
 * Meetings that adjourned without minutes are listed and marked rather than
 * hidden, so a gap in the record is visible to the board.
 */
export default async function MinutesArchivePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [positionResult, meetingsResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    // Unpaginated on purpose: the board meets monthly, so this table grows by
    // roughly a dozen rows a year. A LIMIT here would silently hide the oldest
    // minutes — and for chairs this page is the only route to them. created_at
    // breaks ties because duplicate rows share a meeting_date in practice, and
    // Postgres does not guarantee a stable order among equal keys.
    supabase
      .from("meetings")
      .select("id, meeting_date, minutes_content")
      .eq("status", "adjourned")
      .order("meeting_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const currentPosition = positionResult.data;
  if (!currentPosition) redirect("/login");

  const meetings = (meetingsResult.data ?? []) as Pick<
    Meeting,
    "id" | "meeting_date" | "minutes_content"
  >[];

  const rows = toMinutesArchiveRows(meetings);
  const missingCount = rows.filter((row) => !row.hasMinutes).length;

  // Chairs cannot open /meetings/[id], so they get the marker without the fix-it link.
  const canOpenMeeting = !isChair(currentPosition.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minutes"
        subtitle="Minutes from past board meetings"
      />

      <SectionCard
        title="Past Meetings"
        description={
          missingCount > 0
            ? `${missingCount} of ${rows.length} adjourned ${rows.length === 1 ? "meeting has" : "meetings have"} no minutes on file`
            : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No past meetings yet"
            description="Meetings appear here once they have been adjourned."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) =>
              row.hasMinutes ? (
                <li key={row.id}>
                  <Link
                    href={`/meetings/${row.id}/minutes`}
                    className="flex items-center justify-between gap-4 px-1 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">
                      {formatMeetingDate(row.meetingDate)}
                    </span>
                    <span className="text-muted-foreground">Read minutes →</span>
                  </Link>
                </li>
              ) : (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-1 py-3 text-sm"
                >
                  <span className="font-medium text-muted-foreground">
                    {formatMeetingDate(row.meetingDate)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      No minutes on file
                    </span>
                    {canOpenMeeting && (
                      <Link
                        href={`/meetings/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        Open meeting →
                      </Link>
                    )}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
