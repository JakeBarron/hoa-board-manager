import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { formatMeetingDate, getUpcomingMondays } from "@/lib/dates";
import { buildReminderMailto } from "@/lib/reminder";
import type { PositionName } from "@/types/database";

export const metadata = { title: "Meeting Agenda — HOA Board" };

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social"
>;

const POSITION_ORDER: BoardPositionName[] = [
  "president",
  "vp",
  "secretary",
  "treasurer",
  "pool",
  "membership",
  "tennis",
  "social",
];

const POSITION_LABELS: Record<BoardPositionName, string> = {
  president: "President",
  vp: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  pool: "Pool",
  membership: "Membership",
  tennis: "Tennis",
  social: "Social",
};

/**
 * Meeting agenda page.
 * Finds the next scheduled meeting and renders the standard HOA meeting order
 * with each board member's pre-meeting update inline.
 * Officers and president see a mailto: reminder link for members who haven't submitted.
 */
export default async function AgendaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  // Find the next scheduled meeting; fall back to the next Monday if none exist
  const { data: nextMeeting } = await supabase
    .from("meetings")
    .select("id, meeting_date, status")
    .gte("meeting_date", today)
    .in("status", ["pending", "in_progress"])
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const meetingDate = nextMeeting?.meeting_date ?? getUpcomingMondays(1)[0];
  const hasMeeting = !!nextMeeting;

  // Fetch all positions, pre-meeting updates for the target date, and last minutes
  const [positionsResult, updatesResult, lastMinutesResult] = await Promise.all([
    supabase.from("positions").select("id, name, email"),
    supabase
      .from("pre_meeting_updates")
      .select("position_id, content, submitted_at")
      .eq("meeting_date", meetingDate),
    supabase
      .from("meeting_minutes")
      .select("meeting_date, google_doc_url")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const positions = (positionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    email: string;
  }[];

  const updatesByPositionId = new Map(
    (updatesResult.data ?? []).map((u) => [u.position_id, u])
  );

  const agendaItems = POSITION_ORDER.map((posName) => {
    const pos = positions.find((p) => p.name === posName);
    const update = pos ? updatesByPositionId.get(pos.id) : undefined;
    return {
      position: posName,
      label: POSITION_LABELS[posName],
      content: update?.content ?? null,
      submittedAt: update?.submitted_at ?? null,
    };
  });

  const missingPositions = agendaItems
    .filter((i) => i.content === null)
    .map((i) => i.position);

  const isOfficerOrAbove = canEditAll(currentPosition.role);
  const lastMinutes = lastMinutesResult.data;

  // Build mailto: URL server-side (officer+ only)
  let reminderMailto: string | null = null;
  if (isOfficerOrAbove && missingPositions.length > 0) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const appUrl = `${proto}://${host}`;
    reminderMailto = buildReminderMailto({
      meetingDate,
      boardEmails: positions.map((p) => p.email),
      missingPositions,
      appUrl,
    });
  }

  const submittedCount = agendaItems.length - missingPositions.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meeting Agenda"
        subtitle={
          hasMeeting
            ? formatMeetingDate(meetingDate)
            : `${formatMeetingDate(meetingDate)} — no meeting scheduled`
        }
      />

      {!hasMeeting && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No meeting has been scheduled yet. Showing the next Monday as a
          placeholder.
          {isOfficerOrAbove && (
            <>
              {" "}
              <Link
                href="/meetings/new"
                className="font-medium underline hover:no-underline"
              >
                Schedule a meeting →
              </Link>
            </>
          )}
        </div>
      )}

      <SectionCard
        title="Agenda"
        description={`${submittedCount} of 8 updates submitted`}
      >
        <ol className="space-y-5">
          <AgendaItem number={1} title="Call to Order" />

          <AgendaItem
            number={2}
            title="Approval of Prior Minutes"
            body={
              lastMinutes ? (
                <span className="text-sm text-muted-foreground">
                  {formatMeetingDate(lastMinutes.meeting_date)}
                  {lastMinutes.google_doc_url && (
                    <>
                      {" · "}
                      <a
                        href={lastMinutes.google_doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View minutes
                      </a>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No prior minutes on file.
                </span>
              )
            }
          />

          <li>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">
                3.
              </span>
              <span className="text-sm font-semibold text-foreground">
                Board Reports
              </span>
            </div>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {agendaItems.map((item) => (
                <li key={item.position} className="py-3 pl-5">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.content === null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        — not submitted
                      </span>
                    )}
                  </p>
                  {item.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>

          <AgendaItem number={4} title="New Business" />
          <AgendaItem number={5} title="Adjournment" />
        </ol>
      </SectionCard>

      {isOfficerOrAbove && reminderMailto && (
        <SectionCard
          title="Send Reminder"
          description={`${missingPositions.length} board member${missingPositions.length === 1 ? "" : "s"} have not yet submitted an update.`}
        >
          <a
            href={reminderMailto}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Open reminder email in mail client
          </a>
        </SectionCard>
      )}
    </div>
  );
}

/** Single numbered agenda item with an optional body. */
function AgendaItem({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body?: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">
        {number}.
      </span>
      <div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {body && <div className="mt-1">{body}</div>}
      </div>
    </li>
  );
}
