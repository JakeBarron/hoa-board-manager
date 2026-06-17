import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canEditAll } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { ReminderSection } from "./ReminderSection";
import { StartMeetingButton } from "./StartMeetingButton";
import { formatMeetingDate } from "@/lib/dates";
import { buildReminderMailto } from "@/lib/reminder";
import { BOARD_POSITION_ORDER, COMMITTEE_POSITION_ORDER } from "@/lib/agenda";
import { POSITION_LABELS } from "@/lib/positions";
import type { PositionName, PositionRole } from "@/types/database";

interface MeetingPrepProps {
  meetingId: string;
  meetingDate: string;
  /** reminder_sent_at timestamp on the meeting, or null */
  reminderSentAt: string | null;
  currentPositionId: string;
  currentRole: PositionRole;
}

/**
 * Prep view for a pending meeting — the agenda everyone works toward before the
 * gavel. Renders the standard meeting order with each board/committee
 * pre-meeting update folded inline, a submission checklist, officer reminder
 * buttons for missing updates, and (for officers/president) a Start Meeting
 * launcher. Replaces the former standalone /agenda page.
 *
 * @param meetingId         - UUID of the pending meeting
 * @param meetingDate       - ISO date (YYYY-MM-DD) of the meeting
 * @param reminderSentAt    - When a reminder was last sent, or null
 * @param currentPositionId - Logged-in user's position UUID
 * @param currentRole       - Logged-in user's role
 */
export async function MeetingPrep({
  meetingId,
  meetingDate,
  reminderSentAt,
  currentPositionId,
  currentRole,
}: MeetingPrepProps) {
  const supabase = await createClient();

  const [positionsResult, updatesResult, priorMinutesResult, settingsResult] = await Promise.all([
    supabase.from("positions").select("id, name, email, role, is_voting_member, display_name"),
    supabase.from("pre_meeting_updates").select("position_id, content").eq("meeting_id", meetingId),
    supabase
      .from("meeting_minutes")
      .select("meeting_date, google_doc_url")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("settings").select("key, value").in("key", ["hoa_name", "drive_folder_url"]),
  ]);

  const allPositions = (positionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    email: string;
    role: string;
    is_voting_member: boolean;
    display_name: string | null;
  }[];

  const updatesByPositionId = new Map(
    (updatesResult.data ?? []).map((u) => [u.position_id, u.content as string])
  );

  /** Builds ordered agenda report items for a set of position names. */
  const buildItems = (order: PositionName[]) =>
    order.map((name) => {
      const pos = allPositions.find((p) => p.name === name);
      return {
        position: name,
        label: POSITION_LABELS[name],
        content: pos ? (updatesByPositionId.get(pos.id) ?? null) : null,
      };
    });

  const boardItems = buildItems(BOARD_POSITION_ORDER);
  const committeeItems = buildItems(COMMITTEE_POSITION_ORDER);

  const totalPositions = BOARD_POSITION_ORDER.length + COMMITTEE_POSITION_ORDER.length;
  const submittedCount =
    boardItems.filter((i) => i.content !== null).length +
    committeeItems.filter((i) => i.content !== null).length;

  const missingBoardPositions = boardItems.filter((i) => i.content === null).map((i) => i.position);
  const missingChairPositions = committeeItems.filter((i) => i.content === null).map((i) => i.position);

  const isOfficerOrAbove = canEditAll(currentRole);
  const priorMinutes = priorMinutesResult.data;

  const settingsMap = new Map((settingsResult.data ?? []).map((s) => [s.key, s.value]));
  const hoaName = settingsMap.get("hoa_name");
  const driveFolder = settingsMap.get("drive_folder_url");

  const boardPositions = allPositions.filter((p) =>
    (BOARD_POSITION_ORDER as string[]).includes(p.name)
  );
  const committeePositions = allPositions.filter((p) =>
    (COMMITTEE_POSITION_ORDER as string[]).includes(p.name)
  );

  let boardMailto: string | null = null;
  let chairMailto: string | null = null;
  let allMailto: string | null = null;

  if (isOfficerOrAbove) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const appUrl = `${proto}://${host}`;
    const updateUrl = `${appUrl}/dashboard`;

    if (missingBoardPositions.length > 0) {
      boardMailto = buildReminderMailto({
        meetingDate,
        boardEmails: boardPositions.map((p) => p.email),
        missingPositions: missingBoardPositions,
        appUrl,
        updateUrl,
      });
    }
    if (missingChairPositions.length > 0) {
      chairMailto = buildReminderMailto({
        meetingDate,
        boardEmails: committeePositions.map((p) => p.email),
        missingPositions: missingChairPositions,
        appUrl,
        updateUrl,
      });
    }
    if (missingBoardPositions.length > 0 && missingChairPositions.length > 0) {
      allMailto = buildReminderMailto({
        meetingDate,
        boardEmails: allPositions.map((p) => p.email),
        missingPositions: [...missingBoardPositions, ...missingChairPositions],
        appUrl,
        updateUrl,
      });
    }
  }

  const showReminders =
    isOfficerOrAbove && (boardMailto !== null || chairMailto !== null || allMailto !== null);

  // Positions passed to the runner (chairs excluded — they don't attend votes).
  const runnerPositions = allPositions
    .filter((p) => p.role !== "chair")
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      is_voting_member: p.is_voting_member,
      display_name: p.display_name,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMeetingDate(meetingDate)}
        subtitle="Meeting Prep"
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status="pending" />
            {isOfficerOrAbove && (
              <StartMeetingButton
                positions={runnerPositions}
                currentPositionId={currentPositionId}
                meetingId={meetingId}
                meetingDate={meetingDate}
                driveFolder={driveFolder}
                hoaName={hoaName}
              />
            )}
            <Link
              href="/meetings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← All meetings
            </Link>
          </div>
        }
      />

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
              priorMinutes ? (
                <span className="text-sm text-muted-foreground">
                  {formatMeetingDate(priorMinutes.meeting_date)}
                  {priorMinutes.google_doc_url && (
                    <>
                      {" · "}
                      <a
                        href={priorMinutes.google_doc_url}
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

          <ReportGroup number={3} title="Board Reports" items={boardItems} />
          <ReportGroup number={4} title="Committee Reports" items={committeeItems} />

          <AgendaItem number={5} title="New Business" />
          <AgendaItem number={6} title="Adjournment" />
        </ol>
      </SectionCard>

      {showReminders && (
        <SectionCard
          title="Send Reminder"
          description={`${missingBoardPositions.length + missingChairPositions.length} position${
            missingBoardPositions.length + missingChairPositions.length === 1 ? "" : "s"
          } have not submitted an update.`}
        >
          <ReminderSection
            meetingId={meetingId}
            reminderSentAt={reminderSentAt}
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
      <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">{number}.</span>
      <div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {body && <div className="mt-1">{body}</div>}
      </div>
    </li>
  );
}

/** A numbered agenda group listing each position's submitted update inline. */
function ReportGroup({
  number,
  title,
  items,
}: {
  number: number;
  title: string;
  items: { position: string; label: string; content: string | null }[];
}) {
  return (
    <li>
      <div className="flex items-baseline gap-2">
        <span className="min-w-[1.25rem] text-sm font-semibold text-foreground">{number}.</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {items.map((item) => (
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
  );
}
