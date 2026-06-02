import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { ReminderSection } from "./ReminderSection";
import { formatMeetingDate, getUpcomingMondays } from "@/lib/dates";
import { buildReminderMailto } from "@/lib/reminder";
import type { PositionName } from "@/types/database";
import { POSITION_LABELS } from "@/lib/positions";

export const metadata = { title: "Meeting Agenda — HOA Board" };

type BoardPositionName = Extract<PositionName,
  "president" | "vp" | "secretary" | "treasurer" |
  "pool" | "membership" | "tennis" | "social" | "grounds">;

type ChairPositionName = Extract<PositionName,
  "web" | "architecture" | "welcoming" | "clubhouse" | "cra">;

const POSITION_ORDER: BoardPositionName[] = [
  "president", "vp", "secretary", "treasurer",
  "pool", "membership", "tennis", "social", "grounds",
];

const COMMITTEE_ORDER: ChairPositionName[] = [
  "web", "architecture", "welcoming", "clubhouse", "cra",
];

const COMMITTEE_LABELS: Record<ChairPositionName, string> = {
  web: "Web Committee",
  architecture: "Architecture Review",
  welcoming: "Welcoming Committee",
  clubhouse: "Clubhouse Committee",
  cra: "CRA Committee",
};

/**
 * Meeting agenda page.
 * Finds the next scheduled meeting and renders the standard HOA meeting order
 * with board and committee pre-meeting updates inline.
 * Officers and president see three mailto: reminder buttons for missing submissions.
 * Chairs are redirected to their own committee page.
 */
export default async function AgendaPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("role, name")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  const today = new Date().toISOString().split("T")[0];

  const { data: nextMeeting } = await supabase
    .from("meetings")
    .select("id, meeting_date, status, reminder_sent_at")
    .gte("meeting_date", today)
    .in("status", ["pending", "in_progress"])
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const meetingDate = nextMeeting?.meeting_date ?? getUpcomingMondays(1)[0];
  const hasMeeting = !!nextMeeting;

  const [positionsResult, updatesResult, lastMinutesResult] = await Promise.all([
    supabase.from("positions").select("id, name, email, role"),
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

  const allPositions = (positionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    email: string;
    role: string;
  }[];

  const boardPositions = allPositions.filter((p) =>
    (POSITION_ORDER as string[]).includes(p.name)
  );
  const committeePositions = allPositions.filter((p) =>
    (COMMITTEE_ORDER as string[]).includes(p.name)
  );

  const updatesByPositionId = new Map(
    (updatesResult.data ?? []).map((u) => [u.position_id, u])
  );

  const boardItems = POSITION_ORDER.map((posName) => {
    const pos = boardPositions.find((p) => p.name === posName);
    const update = pos ? updatesByPositionId.get(pos.id) : undefined;
    return { position: posName, label: POSITION_LABELS[posName], content: update?.content ?? null };
  });

  const committeeItems = COMMITTEE_ORDER.map((posName) => {
    const pos = committeePositions.find((p) => p.name === posName);
    const update = pos ? updatesByPositionId.get(pos.id) : undefined;
    return { position: posName, label: COMMITTEE_LABELS[posName], content: update?.content ?? null };
  });

  const totalPositions = POSITION_ORDER.length + COMMITTEE_ORDER.length;
  const submittedCount =
    boardItems.filter((i) => i.content !== null).length +
    committeeItems.filter((i) => i.content !== null).length;

  const missingBoardPositions = boardItems
    .filter((i) => i.content === null)
    .map((i) => i.position as PositionName);
  const missingChairPositions = committeeItems
    .filter((i) => i.content === null)
    .map((i) => i.position as PositionName);

  const isOfficerOrAbove = canEditAll(currentPosition.role);
  const lastMinutes = lastMinutesResult.data;

  let boardMailto: string | null = null;
  let chairMailto: string | null = null;
  let allMailto: string | null = null;

  if (isOfficerOrAbove) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const appUrl = `${proto}://${host}`;

    if (missingBoardPositions.length > 0) {
      boardMailto = buildReminderMailto({
        meetingDate,
        boardEmails: boardPositions.map((p) => p.email),
        missingPositions: missingBoardPositions,
        appUrl,
      });
    }

    if (missingChairPositions.length > 0) {
      chairMailto = buildReminderMailto({
        meetingDate,
        boardEmails: committeePositions.map((p) => p.email),
        missingPositions: missingChairPositions,
        appUrl,
        updateUrl: `${appUrl}/dashboard`,
      });
    }

    if (missingBoardPositions.length > 0 && missingChairPositions.length > 0) {
      allMailto = buildReminderMailto({
        meetingDate,
        boardEmails: allPositions.map((p) => p.email),
        missingPositions: [...missingBoardPositions, ...missingChairPositions],
        appUrl,
        updateUrl: `${appUrl}/dashboard`,
      });
    }
  }

  const showReminders =
    isOfficerOrAbove && (boardMailto !== null || chairMailto !== null || allMailto !== null);

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
          No meeting has been scheduled yet. Showing the next Monday as a placeholder.
          {isOfficerOrAbove && (
            <>
              {" "}
              <Link href="/meetings/new" className="font-medium underline hover:no-underline">
                Schedule a meeting →
              </Link>
            </>
          )}
        </div>
      )}

      <SectionCard
        title="Agenda"
        description={`${submittedCount} of ${totalPositions} updates submitted`}
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
                <span className="text-sm text-muted-foreground">No prior minutes on file.</span>
              )
            }
          />

          <li>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">3.</span>
              <span className="text-sm font-semibold text-foreground">Board Reports</span>
            </div>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {boardItems.map((item) => (
                <li key={item.position} className="py-3 pl-5">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.content === null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">— not submitted</span>
                    )}
                  </p>
                  {item.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                  )}
                </li>
              ))}
            </ul>
          </li>

          <li>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">4.</span>
              <span className="text-sm font-semibold text-foreground">Committee Reports</span>
            </div>
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {committeeItems.map((item) => (
                <li key={item.position} className="py-3 pl-5">
                  <p className="text-sm font-medium">
                    {item.label}
                    {item.content === null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">— not submitted</span>
                    )}
                  </p>
                  {item.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                  )}
                </li>
              ))}
            </ul>
          </li>

          <AgendaItem number={5} title="New Business" />
          <AgendaItem number={6} title="Adjournment" />
        </ol>
      </SectionCard>

      {showReminders && (
        <SectionCard
          title="Send Reminder"
          description={`${missingBoardPositions.length + missingChairPositions.length} position${missingBoardPositions.length + missingChairPositions.length === 1 ? "" : "s"} have not submitted an update.`}
        >
          <ReminderSection
            meetingId={nextMeeting?.id ?? null}
            reminderSentAt={nextMeeting?.reminder_sent_at ?? null}
            boardMailto={boardMailto}
            chairMailto={chairMailto}
            allMailto={allMailto}
          />
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
