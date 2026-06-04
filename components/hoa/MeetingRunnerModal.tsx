"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Loader2 } from "lucide-react";
import { RichTextEditor } from "@/components/hoa/RichTextEditor";
import { Button } from "@/components/ui/button";
import { formatMeetingDate } from "@/lib/dates";
import {
  callToOrder,
  updateAttendance,
  cancelMeeting,
  saveMeetingMinutes,
  adjournMeeting,
} from "@/actions/meetings";
import {
  createMotion,
  secondMotion,
  recordVotes,
  closeMotion,
} from "@/actions/motions";
import { createActionItem } from "@/actions/todos";
import { formatPersonName } from "@/lib/positions";
import type { PositionName } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A board position as passed from the server page. */
interface Position {
  id: string;
  name: string;
  role: string;
  is_voting_member: boolean;
  display_name: string | null;
}

/** Vote choice for a single member in a motion vote panel. */
type VoteChoice = "yay" | "nay" | "absent";

/** One member's vote during a motion. */
interface MemberVote {
  positionId: string;
  vote: VoteChoice;
}

/** Internal state machine views for the modal. */
type ModalView =
  | "attendance"
  | "callToOrder"
  | "running"
  | "voting"
  | "actionItem"
  | "adjourn"
  | "export";

export interface MeetingRunnerModalProps {
  /** All non-chair board positions (treasurer included for attendance; voting members filtered internally) */
  positions: Position[];
  /** UUID of the logged-in user's position */
  currentPositionId: string;
  /** An existing open meeting if one was found for today */
  existingMeeting: { id: string; status: "pending" | "in_progress" } | null;
  /** Called when the modal should close (meeting cancelled or export done) */
  onClose: () => void;
  /** The meeting ID returned by startOrResumeMeeting, already known before render */
  meetingId: string;
  /** Google Drive folder URL from settings — shown in export panel as upload destination */
  driveFolder?: string;
  /** HOA name from settings — used to suggest a minutes document title */
  hoaName?: string;
}

// ─── Timer hook ───────────────────────────────────────────────────────────────

/**
 * Returns a HH:MM:SS elapsed-time string, counting up from `startedAt`.
 * Returns "00:00:00" until startedAt is set.
 *
 * @param startedAt - ISO timestamp string when counting began, or null
 */
function useElapsedTimer(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const origin = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - origin) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the vote result sentence inserted into the minutes editor.
 * Names must be pre-formatted by the caller using formatPersonName().
 * Format: "Motion to [title][: description] — called by [caller], seconded by [seconder]. [Passed/Failed] X–Y–Z ([narrative])."
 *
 * @param title        - Motion title
 * @param callerName   - Pre-formatted name of the proposer (e.g. "President Jake Barron")
 * @param seconderName - Pre-formatted name of the seconder
 * @param votes        - Full vote list with pre-formatted names and choices
 * @param description  - Optional motion description included after the title
 */
function buildVoteResultText(
  title: string,
  callerName: string,
  seconderName: string,
  votes: Array<{ name: string; vote: VoteChoice }>,
  description?: string
): string {
  const yays = votes.filter((v) => v.vote === "yay");
  const nays = votes.filter((v) => v.vote === "nay");
  const absents = votes.filter((v) => v.vote === "absent");
  const passed = yays.length > nays.length;

  let narrative: string;
  if (nays.length === 0 && absents.length === 0) {
    narrative = "Unanimously";
  } else {
    const parts: string[] = [];
    if (nays.length > 0) {
      parts.push(`Nay: ${nays.map((v) => v.name).join(", ")}.`);
    }
    if (absents.length > 0) {
      parts.push(`Absent: ${absents.map((v) => v.name).join(", ")}.`);
    }
    narrative = parts.join(" ");
  }

  const titlePart = description ? `${title}: ${description}` : title;
  return `Motion to ${titlePart} — called by ${callerName}, seconded by ${seconderName}. ${passed ? "Passed" : "Failed"} ${yays.length}–${nays.length}–${absents.length} (${narrative})`;
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

interface AttendancePanelProps {
  positions: Position[];
  presentIds: Set<string>;
  quorumRequired: number;
  onToggle: (id: string) => void;
  onProceed: () => void;
  isPending: boolean;
}

/**
 * Attendance toggle list shown before call to order.
 * Each position row toggles between present and absent.
 * The "Proceed" button is disabled until quorum is met.
 */
function AttendancePanel({
  positions,
  presentIds,
  quorumRequired,
  onToggle,
  onProceed,
  isPending,
}: AttendancePanelProps) {
  const presentCount = presentIds.size;
  const quorumMet = presentCount >= quorumRequired;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div>
        <h2 className="text-xl font-semibold">Attendance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark who is present before calling the meeting to order.
        </p>
      </div>

      <div className="rounded-md border border-border divide-y divide-border">
        {positions.map((p) => {
          const present = presentIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors cursor-pointer ${
                present
                  ? "bg-green-50 text-green-900"
                  : "bg-background text-muted-foreground"
              }`}
            >
              <span className="font-medium">{formatPersonName(p.name as PositionName, p.display_name)}</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  present
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {present ? "Present" : "Absent"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p
          className={`text-sm font-medium ${quorumMet ? "text-green-700" : "text-amber-700"}`}
        >
          {presentCount} of {positions.length} present — quorum: {quorumRequired}
          {quorumMet ? " ✓" : " (not met)"}
        </p>
        <Button onClick={onProceed} disabled={!quorumMet || isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Saving…" : "Proceed to Call to Order"}
        </Button>
      </div>
    </div>
  );
}

interface CallToOrderPanelProps {
  positions: Position[];
  presentIds: Set<string>;
  onConfirm: (calledBy: string, secondedBy: string) => void;
  isPending: boolean;
}

/** Collects who called the meeting to order and who seconded before starting. */
function CallToOrderPanel({
  positions,
  presentIds,
  onConfirm,
  isPending,
}: CallToOrderPanelProps) {
  const presentPositions = positions.filter((p) => presentIds.has(p.id));
  const [calledBy, setCalledBy] = useState(presentPositions[0]?.id ?? "");
  const [secondedBy, setSecondedBy] = useState(
    presentPositions[1]?.id ?? presentPositions[0]?.id ?? ""
  );
  const secondOptions = presentPositions.filter((p) => p.id !== calledBy);

  const handleConfirm = () => {
    if (!calledBy || !secondedBy) return;
    onConfirm(calledBy, secondedBy);
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div>
        <h2 className="text-xl font-semibold">Call to Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who called the meeting to order and who seconded?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="called-by" className="text-sm font-medium">
            Called by <span className="text-destructive">*</span>
          </label>
          <select
            id="called-by"
            value={calledBy}
            onChange={(e) => {
              setCalledBy(e.target.value);
              if (secondedBy === e.target.value) {
                const fallback = presentPositions.find((p) => p.id !== e.target.value);
                setSecondedBy(fallback?.id ?? "");
              }
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {presentPositions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.name as PositionName, p.display_name)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seconded-by" className="text-sm font-medium">
            Seconded by <span className="text-destructive">*</span>
          </label>
          <select
            id="seconded-by"
            value={secondedBy}
            onChange={(e) => setSecondedBy(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {secondOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.name as PositionName, p.display_name)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={handleConfirm} disabled={!calledBy || !secondedBy || isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Starting…" : "Start Meeting"}
      </Button>
    </div>
  );
}

interface VotePanelProps {
  positions: Position[];
  presentIds: Set<string>;
  currentPositionId: string;
  meetingId: string;
  onVoteRecorded: (resultText: string) => void;
  onCancel: () => void;
}

/**
 * Inline vote panel. Collects motion title, proposer, seconder, and one
 * yay/nay/absent button per present member. On submit, persists via actions
 * and returns a formatted result string to insert into the minutes.
 */
function VotePanel({
  positions,
  presentIds,
  currentPositionId,
  meetingId,
  onVoteRecorded,
  onCancel,
}: VotePanelProps) {
  const presentPositions = positions.filter((p) => presentIds.has(p.id));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposedBy, setProposedBy] = useState(presentPositions[0]?.id ?? "");
  const [secondedBy, setSecondedBy] = useState(
    presentPositions[1]?.id ?? presentPositions[0]?.id ?? ""
  );
  const [votes, setVotes] = useState<MemberVote[]>(() =>
    positions.map((p) => ({
      positionId: p.id,
      vote: presentIds.has(p.id) ? "yay" : "absent",
    }))
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const secondOptions = presentPositions.filter((p) => p.id !== proposedBy);

  const setVote = (positionId: string, vote: VoteChoice) => {
    setVotes((prev) =>
      prev.map((v) => (v.positionId === positionId ? { ...v, vote } : v))
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Motion title is required.");
      return;
    }
    if (!proposedBy || !secondedBy) {
      setError("Proposer and seconder are required.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const { id: motionId } = await createMotion(
          meetingId,
          title.trim(),
          proposedBy,
          description.trim() || undefined
        );
        await secondMotion(motionId, secondedBy);
        await recordVotes(
          motionId,
          votes.map((v) => ({
            positionId: v.positionId,
            vote: v.vote,
            recordedBy: currentPositionId,
          }))
        );

        const yayCount = votes.filter((v) => v.vote === "yay").length;
        const nayCount = votes.filter((v) => v.vote === "nay").length;
        const passed = yayCount > nayCount;
        const quorumMet = presentIds.size >= 5;

        await closeMotion(motionId, passed, quorumMet);

        const proposerPos = positions.find((p) => p.id === proposedBy);
        const seconderPos = positions.find((p) => p.id === secondedBy);
        const proposerName = proposerPos
          ? formatPersonName(proposerPos.name as PositionName, proposerPos.display_name)
          : proposedBy;
        const seconderName = seconderPos
          ? formatPersonName(seconderPos.name as PositionName, seconderPos.display_name)
          : secondedBy;
        const votesWithNames = votes.map((v) => {
          const pos = positions.find((p) => p.id === v.positionId);
          return {
            name: pos
              ? formatPersonName(pos.name as PositionName, pos.display_name)
              : v.positionId,
            vote: v.vote,
          };
        });

        const resultText = buildVoteResultText(
          title.trim(),
          proposerName,
          seconderName,
          votesWithNames,
          description.trim() || undefined
        );
        onVoteRecorded(resultText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record vote.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Call a Vote</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="motion-title" className="text-sm font-medium">
            Motion title <span className="text-destructive">*</span>
          </label>
          <input
            id="motion-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Approve fence repair budget of $4,500"
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="motion-description" className="text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="motion-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="proposed-by" className="text-sm font-medium">
              Proposed by <span className="text-destructive">*</span>
            </label>
            <select
              id="proposed-by"
              value={proposedBy}
              onChange={(e) => {
                setProposedBy(e.target.value);
                if (secondedBy === e.target.value) {
                  const fallback = presentPositions.find((p) => p.id !== e.target.value);
                  setSecondedBy(fallback?.id ?? "");
                }
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {presentPositions.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPersonName(p.name as PositionName, p.display_name)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vote-seconded-by" className="text-sm font-medium">
              Seconded by <span className="text-destructive">*</span>
            </label>
            <select
              id="vote-seconded-by"
              value={secondedBy}
              onChange={(e) => setSecondedBy(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {secondOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPersonName(p.name as PositionName, p.display_name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Votes</p>
          <div className="rounded-md border border-border divide-y divide-border">
            {positions.map((p) => {
              const memberVote = votes.find((v) => v.positionId === p.id);
              const current = memberVote?.vote ?? "absent";
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm font-medium">{formatPersonName(p.name as PositionName, p.display_name)}</span>
                  <div className="flex gap-1">
                    {(["yay", "nay", "absent"] as VoteChoice[]).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setVote(p.id, choice)}
                        className={`px-3 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          current === choice
                            ? choice === "yay"
                              ? "bg-green-600 text-white border-green-600"
                              : choice === "nay"
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-slate-600 text-white border-slate-600"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {choice.charAt(0).toUpperCase() + choice.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Recording…" : "Record Vote"}
      </Button>
    </div>
  );
}

interface ActionItemPanelProps {
  positions: Position[];
  onCreated: (positionName: string, title: string) => void;
  onCancel: () => void;
  meetingId: string;
}

/**
 * Inline panel to create an action item (todo) for a specific position.
 * On success, returns the assignee name and title so the caller can
 * append a note to the minutes.
 */
function ActionItemPanel({
  positions,
  onCreated,
  onCancel,
  meetingId,
}: ActionItemPanelProps) {
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(positions[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreate = () => {
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!assignee) {
      setError("Please select an assignee.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await createActionItem(assignee, description.trim(), meetingId, dueDate || undefined);
        const assigneePos = positions.find((p) => p.id === assignee);
        const assigneeLabel = assigneePos
          ? formatPersonName(assigneePos.name as PositionName, assigneePos.display_name)
          : assignee;
        setSuccess(true);
        setTimeout(() => {
          onCreated(assigneeLabel, description.trim());
        }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create action item.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Create Action Item</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>

      {success ? (
        <p className="text-sm font-medium text-green-700">✓ Action item created.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="action-description" className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </label>
            <input
              id="action-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Contact fence vendor for revised quote"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="action-assignee" className="text-sm font-medium">
              Assignee <span className="text-destructive">*</span>
            </label>
            <select
              id="action-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPersonName(p.name as PositionName, p.display_name)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="action-due-date" className="text-sm font-medium">
              Due date (optional)
            </label>
            <input
              id="action-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface AdjournPanelProps {
  positions: Position[];
  presentIds: Set<string>;
  onAdjourn: (proposedBy: string, secondedBy: string) => void;
  isPending: boolean;
}

/** Collects who moved and seconded adjournment before closing the meeting. */
function AdjournPanel({
  positions,
  presentIds,
  onAdjourn,
  isPending,
}: AdjournPanelProps) {
  const presentPositions = positions.filter((p) => presentIds.has(p.id));
  const [movedBy, setMovedBy] = useState(presentPositions[0]?.id ?? "");
  const [secondedBy, setSecondedBy] = useState(
    presentPositions[1]?.id ?? presentPositions[0]?.id ?? ""
  );
  const secondOptions = presentPositions.filter((p) => p.id !== movedBy);

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div>
        <h2 className="text-xl font-semibold">Adjourn Meeting</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who moved to adjourn and who seconded?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="adjourn-moved-by" className="text-sm font-medium">
            Moved by <span className="text-destructive">*</span>
          </label>
          <select
            id="adjourn-moved-by"
            value={movedBy}
            onChange={(e) => {
              setMovedBy(e.target.value);
              if (secondedBy === e.target.value) {
                const fallback = presentPositions.find((p) => p.id !== e.target.value);
                setSecondedBy(fallback?.id ?? "");
              }
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {presentPositions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.name as PositionName, p.display_name)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="adjourn-seconded-by" className="text-sm font-medium">
            Seconded by <span className="text-destructive">*</span>
          </label>
          <select
            id="adjourn-seconded-by"
            value={secondedBy}
            onChange={(e) => setSecondedBy(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {secondOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.name as PositionName, p.display_name)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        onClick={() => onAdjourn(movedBy, secondedBy)}
        disabled={!movedBy || !secondedBy || isPending}
        variant="destructive"
      >
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Adjourning…" : "Formally Adjourn"}
      </Button>
    </div>
  );
}

interface ExportPanelProps {
  meetingId: string;
  meetingDate: string;
  onClose: () => void;
}

/**
 * Post-adjournment panel. Minutes are automatically saved to Documents on adjournment.
 * Offers an on-demand .docx download for the secretary's convenience.
 */
function ExportPanel({ meetingId, meetingDate, onClose }: ExportPanelProps) {
  const handleExport = () => {
    window.open(`/api/meetings/${meetingId}/export`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div>
        <h2 className="text-xl font-semibold">Meeting Adjourned</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatMeetingDate(meetingDate)} — Minutes have been saved to Documents.
        </p>
      </div>

      <Button onClick={handleExport} variant="outline">
        Export Minutes (.docx)
      </Button>

      <Button onClick={onClose}>Close</Button>
    </div>
  );
}

// ─── Cancel confirmation ───────────────────────────────────────────────────────

interface CancelConfirmProps {
  onConfirm: () => void;
  onDismiss: () => void;
  isPending: boolean;
}

/** Inline confirmation prompt shown when the operator clicks Cancel. */
function CancelConfirm({ onConfirm, onDismiss, isPending }: CancelConfirmProps) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-start justify-between gap-4">
      <p className="text-sm text-destructive font-medium">
        Cancel this meeting? All data will be permanently deleted.
      </p>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Cancelling…" : "Confirm Cancel"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={isPending}>
          Keep Going
        </Button>
      </div>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

interface TopBarProps {
  meetingDate: string;
  elapsed: string;
  view: ModalView;
  onCallVote: () => void;
  onCreateActionItem: () => void;
  onAdjourn: () => void;
  onCancel: () => void;
}

/**
 * Fixed top bar for the running view.
 * Shows date, timer, and action buttons. In non-running views the action
 * buttons are hidden but the cancel button remains.
 */
function TopBar({
  meetingDate,
  elapsed,
  view,
  onCallVote,
  onCreateActionItem,
  onAdjourn,
  onCancel,
}: TopBarProps) {
  const isRunning = view === "running";

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold">{formatMeetingDate(meetingDate)}</span>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {elapsed}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isRunning && (
          <>
            <Button size="sm" variant="outline" onClick={onCallVote}>
              Call Vote
            </Button>
            <Button size="sm" variant="outline" onClick={onCreateActionItem}>
              Create Action Item
            </Button>
            <Button size="sm" variant="destructive" onClick={onAdjourn}>
              Adjourn
            </Button>
          </>
        )}
        {view !== "export" && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

/**
 * Full-screen meeting runner modal.
 *
 * Manages a state machine through: attendance → callToOrder → running →
 * voting / actionItem → adjourn → export.
 *
 * The server page calls startOrResumeMeeting before rendering this component,
 * so the meetingId is always available on mount.
 *
 * @param positions          - All 8 board positions
 * @param currentPositionId  - The logged-in user's position UUID
 * @param existingMeeting    - An already-open meeting for today, if any
 * @param onClose            - Called when the modal should close
 * @param meetingId          - UUID of the meeting being run
 */
export function MeetingRunnerModal({
  positions,
  currentPositionId,
  existingMeeting,
  onClose,
  meetingId,
  driveFolder,
  hoaName,
}: MeetingRunnerModalProps) {
  const votingPositions = positions.filter((p) => p.is_voting_member);

  const initialView: ModalView =
    existingMeeting?.status === "in_progress" ? "running" : "attendance";

  const [view, setView] = useState<ModalView>(initialView);
  const [presentIds, setPresentIds] = useState<Set<string>>(
    () => new Set(positions.map((p) => p.id))
  );
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [meetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [minutesContent, setMinutesContent] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const editorKey = useRef(0);
  const [editorContent, setEditorContent] = useState("");

  const elapsed = useElapsedTimer(startedAt);

  const QUORUM_REQUIRED = 5;

  const togglePresent = (id: string) => {
    const next = new Set(presentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setPresentIds(next);
    startTransition(async () => {
      await updateAttendance(meetingId, Array.from(next));
    });
  };

  const handleProceedToCallToOrder = () => {
    setView("callToOrder");
  };

  const handleCallToOrder = (calledBy: string, secondedBy: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await callToOrder(meetingId, calledBy, secondedBy, Array.from(presentIds));
        setStartedAt(new Date().toISOString());
        setView("running");
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to start meeting.");
      }
    });
  };

  const handleVoteRecorded = (resultText: string) => {
    const newContent = minutesContent
      ? `${minutesContent}<p>${resultText}</p>`
      : `<p>${resultText}</p>`;

    setMinutesContent(newContent);
    setEditorContent(newContent);
    editorKey.current += 1;

    startTransition(async () => {
      await saveMeetingMinutes(meetingId, newContent);
    });

    setView("running");
  };

  const handleActionItemCreated = (positionName: string, title: string) => {
    const note = `Action item assigned to ${positionName}: ${title}`;
    const newContent = minutesContent
      ? `${minutesContent}<p>${note}</p>`
      : `<p>${note}</p>`;

    setMinutesContent(newContent);
    setEditorContent(newContent);
    editorKey.current += 1;

    startTransition(async () => {
      await saveMeetingMinutes(meetingId, newContent);
    });

    setView("running");
  };

  const handleAdjourn = (proposedBy: string, secondedBy: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await saveMeetingMinutes(meetingId, minutesContent);
        const { uploadError } = await adjournMeeting(meetingId, proposedBy, secondedBy);
        setView("export");
        if (uploadError) {
          setActionError(`Minutes adjourned but document upload failed: ${uploadError}`);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to adjourn.");
      }
    });
  };

  const handleCancelConfirm = () => {
    startTransition(async () => {
      try {
        await cancelMeeting(meetingId);
        onClose();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to cancel meeting.");
        setShowCancelConfirm(false);
      }
    });
  };

  const handleMinutesChange = (html: string) => {
    setMinutesContent(html);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "white" }}
      className="flex flex-col"
    >
      <TopBar
        meetingDate={meetingDate}
        elapsed={elapsed}
        view={view}
        onCallVote={() => setView("voting")}
        onCreateActionItem={() => setView("actionItem")}
        onAdjourn={() => setView("adjourn")}
        onCancel={() => setShowCancelConfirm(true)}
      />

      {showCancelConfirm && (
        <div className="px-4 pt-3 shrink-0">
          <CancelConfirm
            onConfirm={handleCancelConfirm}
            onDismiss={() => setShowCancelConfirm(false)}
            isPending={isPending}
          />
        </div>
      )}

      {actionError && (
        <div className="px-4 pt-3 shrink-0">
          <p role="alert" className="text-xs text-destructive">
            {actionError}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {view === "attendance" && (
          <AttendancePanel
            positions={positions}
            presentIds={presentIds}
            quorumRequired={QUORUM_REQUIRED}
            onToggle={togglePresent}
            onProceed={handleProceedToCallToOrder}
            isPending={isPending}
          />
        )}

        {view === "callToOrder" && (
          <CallToOrderPanel
            positions={votingPositions}
            presentIds={presentIds}
            onConfirm={handleCallToOrder}
            isPending={isPending}
          />
        )}

        {view === "running" && (
          <div className="p-4 h-full flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Meeting in progress — use the buttons above to call votes, assign
              action items, or adjourn.
            </p>
            <div className="flex-1">
              <RichTextEditor
                key={editorKey.current}
                initialContent={editorContent}
                onChange={handleMinutesChange}
              />
            </div>
          </div>
        )}

        {view === "voting" && (
          <VotePanel
            positions={votingPositions}
            presentIds={presentIds}
            currentPositionId={currentPositionId}
            meetingId={meetingId}
            onVoteRecorded={handleVoteRecorded}
            onCancel={() => setView("running")}
          />
        )}

        {view === "actionItem" && (
          <ActionItemPanel
            positions={positions}
            meetingId={meetingId}
            onCreated={handleActionItemCreated}
            onCancel={() => setView("running")}
          />
        )}

        {view === "adjourn" && (
          <AdjournPanel
            positions={votingPositions}
            presentIds={presentIds}
            onAdjourn={handleAdjourn}
            isPending={isPending}
          />
        )}

        {view === "export" && (
          <ExportPanel
            meetingId={meetingId}
            meetingDate={meetingDate}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
