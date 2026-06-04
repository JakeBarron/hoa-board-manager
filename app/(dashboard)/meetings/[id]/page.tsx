import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { formatMeetingDate } from "@/lib/dates";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { EmptyState } from "@/components/hoa/EmptyState";
import { AddAmendmentForm } from "./AddAmendmentForm";
import type {
  Motion,
  MotionVote,
  MeetingDocument,
  MotionStatus,
  VoteChoice,
  PositionName,
  Todo,
} from "@/types/database";
import { POSITION_LABELS, formatPersonName } from "@/lib/positions";

export const metadata = { title: "Meeting Details — HOA Board" };

// ─── Display helpers ──────────────────────────────────────────────────────────

type BoardPositionName = Extract<
  PositionName,
  "president" | "vp" | "secretary" | "treasurer" | "pool" | "membership" | "tennis" | "social" | "grounds"
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
  "grounds",
];

const VOTE_LABELS: Record<VoteChoice, string> = {
  yay: "Yay",
  nay: "Nay",
  absent: "Absent",
  no_vote: "No vote",
};

const MOTION_STATUS_LABELS: Record<MotionStatus, string> = {
  proposed: "Proposed",
  seconded: "Seconded",
  voting: "Voting",
  passed: "Passed",
  failed: "Failed",
  tabled: "Tabled",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Formats a timestamptz string as a short time string (e.g. "7:03 PM").
 * Returns null if the input is null or undefined.
 *
 * @param ts - ISO timestamp string or null
 */
function formatTime(ts: string | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Calculates a human-readable duration string from two ISO timestamps.
 * Returns null if either timestamp is missing.
 *
 * @param startedAt   - ISO timestamp string for meeting start
 * @param adjournedAt - ISO timestamp string for meeting end
 */
function calcDuration(
  startedAt: string | null,
  adjournedAt: string | null
): string | null {
  if (!startedAt || !adjournedAt) return null;
  const ms = new Date(adjournedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return null;
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Tallies yay / nay / absent votes for a single motion.
 * Returns counts and a formatted string like "Passed 5–1–2".
 *
 * @param votes  - All votes for the motion
 * @param status - Current motion status
 */
function tallyVotes(
  votes: Pick<MotionVote, "vote">[],
  status: MotionStatus
): { yay: number; nay: number; absent: number; label: string } {
  const yay = votes.filter((v) => v.vote === "yay").length;
  const nay = votes.filter((v) => v.vote === "nay").length;
  const absent = votes.filter((v) => v.vote === "absent").length;
  const outcome =
    status === "passed"
      ? "Passed"
      : status === "failed"
        ? "Failed"
        : status === "tabled"
          ? "Tabled"
          : "Result";
  return { yay, nay, absent, label: `${outcome} ${yay}–${nay}–${absent}` };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Read-only detail page for a single board meeting.
 * Shows meeting info, attendance, motions with vote breakdowns, action items,
 * and documents. Officer+ users also see an inline form for attaching amendments.
 *
 * @param params - Route params containing the meeting UUID as `id`
 */
export default async function MeetingDetailPage({
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

  const [
    positionResult,
    meetingResult,
    allPositionsResult,
    motionsResult,
    meetingDocsResult,
    quorumSettingResult,
    actionItemsResult,
  ] = await Promise.all([
    supabase
      .from("positions")
      .select("id, name, role")
      .eq("email", user.email!)
      .single(),
    supabase
      .from("meetings")
      .select(
        "id, meeting_date, status, called_by, seconded_by, started_at, adjourned_at, minutes_drive_url, storage_path, present_positions"
      )
      .eq("id", id)
      .single(),
    supabase.from("positions").select("id, name, display_name"),
    supabase
      .from("motions")
      .select(
        "id, title, description, proposed_by, seconded_by, status, quorum_met, closed_at"
      )
      .eq("meeting_id", id)
      .order("closed_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("meeting_documents")
      .select("id, name, drive_url, storage_path, doc_type, amendment_number")
      .eq("meeting_id", id)
      .order("amendment_number", { ascending: true, nullsFirst: false }),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "quorum_required")
      .single(),
    supabase
      .from("todos")
      .select("id, title, position_id, completed, due_date")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const currentPosition = positionResult.data;
  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  const meeting = meetingResult.data;
  if (!meeting) redirect("/meetings");

  const allPositions = (allPositionsResult.data ?? []) as {
    id: string;
    name: PositionName;
    display_name: string | null;
  }[];

  const motions = (motionsResult.data ?? []) as Pick<
    Motion,
    | "id"
    | "title"
    | "description"
    | "proposed_by"
    | "seconded_by"
    | "status"
    | "quorum_met"
    | "closed_at"
  >[];

  const meetingDocs = (meetingDocsResult.data ?? []) as Pick<
    MeetingDocument,
    "id" | "name" | "drive_url" | "storage_path" | "doc_type" | "amendment_number"
  >[];

  const actionItems = (actionItemsResult.data ?? []) as Pick<
    Todo,
    "id" | "title" | "position_id" | "completed" | "due_date"
  >[];

  const quorumRequired = quorumSettingResult.data
    ? parseInt(quorumSettingResult.data.value, 10)
    : 5;

  const positionNameById = new Map(
    allPositions.map((p) => [p.id, p.name as PositionName])
  );

  // Maps position ID → formatted display string ("Vice President Jake Barron" or "Vice President")
  const positionFormatById = new Map(
    allPositions.map((p) => [
      p.id,
      formatPersonName(p.name, p.display_name),
    ])
  );

  // Fetch votes for all motions in one query
  const motionIds = motions.map((m) => m.id);
  let allVotes: Pick<MotionVote, "motion_id" | "position_id" | "vote">[] = [];
  if (motionIds.length > 0) {
    const votesResult = await supabase
      .from("motion_votes")
      .select("motion_id, position_id, vote")
      .in("motion_id", motionIds);
    allVotes = (votesResult.data ?? []) as Pick<
      MotionVote,
      "motion_id" | "position_id" | "vote"
    >[];
  }

  const votesByMotionId = new Map<
    string,
    Pick<MotionVote, "motion_id" | "position_id" | "vote">[]
  >();
  for (const vote of allVotes) {
    const existing = votesByMotionId.get(vote.motion_id) ?? [];
    existing.push(vote);
    votesByMotionId.set(vote.motion_id, existing);
  }

  const presentPositionIds = new Set<string>(meeting.present_positions ?? []);
  const attendanceAvailable = (meeting.present_positions ?? []).length > 0;
  const presentCount = attendanceAvailable ? presentPositionIds.size : null;

  const amendments = meetingDocs.filter((d) => d.doc_type === "amendment");
  const primaryMinutesDoc = meetingDocs.find((d) => d.doc_type === "minutes");
  const nextAmendmentNumber = amendments.length + 1;

  // Collect all storage paths needing signed URLs and fetch in one batch call (1-hour TTL)
  const storagePaths: string[] = [];
  if (meeting.storage_path) storagePaths.push(meeting.storage_path);
  const storageAmendments = amendments.filter((a) => a.storage_path) as typeof amendments & { storage_path: string }[];
  storageAmendments.forEach((a) => storagePaths.push(a.storage_path!));

  const signedUrlByPath = new Map<string, string>();
  if (storagePaths.length > 0) {
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrls(storagePaths, 3600);
    urlData?.forEach((entry) => {
      if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
    });
  }

  const minutesSignedUrl = meeting.storage_path
    ? (signedUrlByPath.get(meeting.storage_path) ?? null)
    : null;

  const amendmentSignedUrls = new Map<string, string>();
  storageAmendments.forEach((a) => {
    const url = signedUrlByPath.get(a.storage_path!);
    if (url) amendmentSignedUrls.set(a.id, url);
  });

  const isOfficerOrAbove = canEditAll(currentPosition.role);

  const calledByLabel = positionFormatById.get(meeting.called_by) ?? "Unknown";
  const secondedByLabel = meeting.seconded_by
    ? (positionFormatById.get(meeting.seconded_by) ?? "—")
    : null;

  const startedTime = formatTime(meeting.started_at);
  const adjournedTime = formatTime(meeting.adjourned_at);
  const duration = calcDuration(meeting.started_at, meeting.adjourned_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMeetingDate(meeting.meeting_date)}
        subtitle="Board Meeting"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={meeting.status} />
            <Link
              href="/meetings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← All meetings
            </Link>
          </div>
        }
      />

      {/* ── Meeting Info ──────────────────────────────────────────────────── */}
      <SectionCard title="Meeting Info">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          <InfoRow label="Called to order by" value={calledByLabel} />
          <InfoRow label="Seconded by" value={secondedByLabel ?? "—"} />
          <InfoRow label="Started" value={startedTime ?? "Not yet started"} />
          <InfoRow
            label="Adjourned"
            value={
              adjournedTime ??
              (meeting.status === "in_progress" ? "In progress" : "—")
            }
          />
          {duration && <InfoRow label="Duration" value={duration} />}
          {presentCount !== null && (
            <InfoRow
              label="Quorum"
              value={`${presentCount} present${presentCount >= quorumRequired ? " (quorum met)" : " (quorum not met)"}`}
            />
          )}
        </dl>
      </SectionCard>

      {/* ── Attendance ────────────────────────────────────────────────────── */}
      <SectionCard
        title="Attendance"
        description={`Quorum requires ${quorumRequired} members`}
      >
        {attendanceAvailable ? (
          <ul className="divide-y divide-border">
            {POSITION_ORDER.map((posName) => {
              const pos = allPositions.find((p) => p.name === posName);
              const isPresent = pos ? presentPositionIds.has(pos.id) : false;
              return (
                <li
                  key={posName}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">
                    {pos ? (positionFormatById.get(pos.id) ?? POSITION_LABELS[posName]) : POSITION_LABELS[posName]}
                  </span>
                  <span
                    className={
                      isPresent
                        ? "text-green-700 font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {isPresent ? "Present" : "Absent"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Attendance was not recorded for this meeting.
          </p>
        )}
      </SectionCard>

      {/* ── Motions ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Motions</h2>
        {motions.length === 0 ? (
          <SectionCard title="Motions">
            <EmptyState
              title="No motions recorded"
              description="Motions will appear here once the meeting runner is used."
            />
          </SectionCard>
        ) : (
          motions.map((motion) => {
            const votes = votesByMotionId.get(motion.id) ?? [];
            const proposedByLabel = positionFormatById.get(motion.proposed_by);
            const motionSecondedByLabel = motion.seconded_by
              ? positionFormatById.get(motion.seconded_by)
              : null;
            const tally = tallyVotes(votes, motion.status);

            return (
              <SectionCard
                key={motion.id}
                title={motion.title}
                description={motion.description ?? undefined}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {proposedByLabel && (
                      <span className="text-muted-foreground">
                        Proposed by{" "}
                        <span className="font-medium text-foreground">
                          {proposedByLabel}
                        </span>
                      </span>
                    )}
                    {motionSecondedByLabel && (
                      <span className="text-muted-foreground">
                        Seconded by{" "}
                        <span className="font-medium text-foreground">
                          {motionSecondedByLabel}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </span>
                    <span className="text-sm font-medium">
                      {MOTION_STATUS_LABELS[motion.status]}
                    </span>
                    {motion.quorum_met !== null && (
                      <span className="text-xs text-muted-foreground">
                        · quorum {motion.quorum_met ? "met" : "not met"}
                      </span>
                    )}
                  </div>

                  {votes.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{tally.label}</div>
                      <ul className="divide-y divide-border rounded-md border border-border text-sm">
                        {POSITION_ORDER.map((posName) => {
                          const pos = allPositions.find(
                            (p) => p.name === posName
                          );
                          const vote = pos
                            ? votes.find((v) => v.position_id === pos.id)
                            : undefined;
                          const voteChoice: VoteChoice =
                            vote?.vote ?? "absent";
                          return (
                            <li
                              key={posName}
                              className="flex items-center justify-between px-3 py-1.5"
                            >
                              <span>
                                {pos ? (positionFormatById.get(pos.id) ?? POSITION_LABELS[posName]) : POSITION_LABELS[posName]}
                              </span>
                              <VoteChip vote={voteChoice} />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No votes recorded.
                    </p>
                  )}
                </div>
              </SectionCard>
            );
          })
        )}
      </div>

      {/* ── Action Items ──────────────────────────────────────────────────── */}
      <SectionCard title="Action Items">
        {actionItems.length === 0 ? (
          <EmptyState
            title="No action items"
            description="Action items assigned during the meeting will appear here."
          />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {actionItems.map((item) => {
              const assigneeLabel = positionFormatById.get(item.position_id);
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="space-y-0.5">
                    <p
                      className={
                        item.completed
                          ? "line-through text-muted-foreground"
                          : "font-medium"
                      }
                    >
                      {item.title}
                    </p>
                    {assigneeLabel && (
                      <p className="text-xs text-muted-foreground">
                        {assigneeLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due {item.due_date}
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium ${item.completed ? "text-green-700" : "text-amber-600"}`}
                    >
                      {item.completed ? "Done" : "Open"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ── Minutes & Documents ───────────────────────────────────────────── */}
      <SectionCard
        title="Minutes & Documents"
        headerAction={
          isOfficerOrAbove ? (
            <AddAmendmentForm
              meetingId={meeting.id}
              nextAmendmentNumber={nextAmendmentNumber}
            />
          ) : undefined
        }
      >
        <div className="space-y-4">
          {minutesSignedUrl || meeting.minutes_drive_url || primaryMinutesDoc ? (
            <div className="text-sm">
              <span className="font-medium">Minutes: </span>
              <a
                href={
                  minutesSignedUrl ??
                  meeting.minutes_drive_url ??
                  primaryMinutesDoc!.drive_url ??
                  "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {minutesSignedUrl ? "Download Minutes (.docx)" : "View Minutes"}
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No minutes on file yet.
            </p>
          )}

          {amendments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Amendments</p>
              <ul className="space-y-1.5">
                {amendments.map((doc) => {
                  const href =
                    amendmentSignedUrls.get(doc.id) ?? doc.drive_url ?? "#";
                  const isStorage = amendmentSignedUrls.has(doc.id);
                  return (
                    <li key={doc.id} className="text-sm">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {doc.name}
                        {isStorage ? " (.docx)" : ""}
                      </a>
                      {doc.amendment_number !== null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          #{doc.amendment_number}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single definition-list row used in the Meeting Info section.
 *
 * @param label - The field label
 * @param value - The display value
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Color-coded chip showing a single vote choice.
 *
 * @param vote - The vote value (yay | nay | absent | no_vote)
 */
function VoteChip({ vote }: { vote: VoteChoice }) {
  const styles: Record<VoteChoice, string> = {
    yay: "bg-green-100 text-green-800 border-green-200",
    nay: "bg-red-100 text-red-800 border-red-200",
    absent: "bg-slate-100 text-slate-500 border-slate-200",
    no_vote: "bg-slate-100 text-slate-400 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[vote]}`}
    >
      {VOTE_LABELS[vote]}
    </span>
  );
}
