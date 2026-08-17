"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordMotion } from "@/actions/motions";
import { buildVoteResultText, type NamedVote } from "@/lib/agenda";
import { formatPersonName } from "@/lib/positions";
import type { PositionName, VoteChoice } from "@/types/database";
import { MoverSeconderFields, useMoverSeconder } from "./MoverSeconder";
import type { PendingVote, Position } from "./types";

/** The four ways a seat can be recorded, in the order they are offered. */
const VOTE_CHOICES: ReadonlyArray<{ value: VoteChoice; label: string }> = [
  { value: "yay", label: "Yay" },
  { value: "nay", label: "Nay" },
  { value: "no_vote", label: "Abstain" },
  { value: "absent", label: "Absent" },
];

/**
 * Tailwind classes for the selected state of each choice. Each keeps its hue in
 * dark mode but lightens the fill and darkens the text, so a chosen vote stays
 * legible against a dark surface.
 */
const SELECTED_STYLE: Record<VoteChoice, string> = {
  yay: "bg-green-600 text-white border-green-600 dark:bg-green-500 dark:border-green-500 dark:text-green-950",
  nay: "bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500 dark:text-red-950",
  no_vote:
    "bg-amber-500 text-white border-amber-500 dark:bg-amber-400 dark:border-amber-400 dark:text-amber-950",
  absent:
    "bg-slate-600 text-white border-slate-600 dark:bg-slate-400 dark:border-slate-400 dark:text-slate-950",
};

export interface VotePanelProps {
  /** All voting positions, present or not. */
  votingPositions: Position[];
  presentIds: Set<string>;
  meetingId: string;
  /** Receives the sentence to insert into the minutes. */
  onVoteRecorded: (resultText: string) => void;
  onCancel: () => void;
}

/**
 * Records one motion: its text, who moved and seconded it, and every voting
 * member's choice.
 *
 * Seats are seeded only where attendance already establishes the answer — anyone
 * not marked present starts as `absent`. Everyone in the room starts **unset**,
 * and the panel refuses to submit until each has a choice. The previous version
 * defaulted every present member to `yay`, so submitting without touching the
 * slate recorded a unanimous pass that never happened.
 *
 * Persistence is a single `recordMotion` call. The tally it returns is what goes
 * into the minutes, so the sentence and the `motion_votes` rows cannot disagree.
 *
 * The panel is a real `<form>`, so Enter from the motion title records the vote
 * once the slate is complete. It was mouse-only before, in the middle of a
 * meeting being typed at speed.
 *
 * @param votingPositions - Every voting seat
 * @param presentIds      - Ids marked present at roll call
 * @param meetingId       - UUID of the meeting in progress
 * @param onVoteRecorded  - Called with the minutes sentence on success
 * @param onCancel        - Dismisses the panel without recording
 */
export function VotePanel({
  votingPositions,
  presentIds,
  meetingId,
  onVoteRecorded,
  onCancel,
}: VotePanelProps) {
  const presentPositions = votingPositions.filter((p) => presentIds.has(p.id));
  const moverSeconder = useMoverSeconder(presentPositions);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votes, setVotes] = useState<Record<string, PendingVote>>(() =>
    Object.fromEntries(
      votingPositions.map((p) => [p.id, presentIds.has(p.id) ? null : "absent"])
    )
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const undecided = presentPositions.filter((p) => votes[p.id] == null);
  const canSubmit =
    title.trim().length > 0 && moverSeconder.isComplete && undecided.length === 0;

  const setVote = (positionId: string, vote: VoteChoice) =>
    setVotes((prev) => ({ ...prev, [positionId]: vote }));

  const markAllYay = () =>
    setVotes((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, vote]) => [
          id,
          presentIds.has(id) ? "yay" : vote,
        ])
      )
    );

  const nameOf = (p: Position) =>
    formatPersonName(p.name as PositionName, p.display_name);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter can reach here while the slate is incomplete; the same gate the
    // submit button uses applies.
    if (!canSubmit || isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const cast = votingPositions.map((p) => ({
          positionId: p.id,
          vote: (votes[p.id] ?? "absent") as VoteChoice,
        }));

        const tally = await recordMotion(meetingId, {
          title: title.trim(),
          description: description.trim() || null,
          proposedBy: moverSeconder.movedBy,
          secondedBy: moverSeconder.secondedBy,
          votes: cast,
        });

        const named: NamedVote[] = cast.map(({ positionId, vote }) => {
          const position = votingPositions.find((p) => p.id === positionId);
          return { name: position ? nameOf(position) : positionId, vote };
        });
        const proposer = votingPositions.find((p) => p.id === moverSeconder.movedBy);
        const seconder = votingPositions.find((p) => p.id === moverSeconder.secondedBy);

        onVoteRecorded(
          buildVoteResultText({
            title: title.trim(),
            description: description.trim() || null,
            callerName: proposer ? nameOf(proposer) : moverSeconder.movedBy,
            seconderName: seconder ? nameOf(seconder) : moverSeconder.secondedBy,
            tally,
            votes: named,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record vote.");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoverSeconderFields
            idPrefix="motion"
            moverLabel="Proposed by"
            presentPositions={presentPositions}
            state={moverSeconder}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Votes</p>
            <Button variant="outline" size="sm" onClick={markAllYay} disabled={isPending}>
              Mark all Yay
            </Button>
          </div>
          <div className="rounded-md border border-border divide-y divide-border">
            {votingPositions.map((p) => {
              const current = votes[p.id] ?? null;
              const isPresent = presentIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4"
                >
                  <span
                    className={`text-sm font-medium ${
                      isPresent ? "" : "text-muted-foreground"
                    }`}
                  >
                    {nameOf(p)}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {VOTE_CHOICES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={current === value}
                        onClick={() => setVote(p.id, value)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          current === value
                            ? SELECTED_STYLE[value]
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undecided.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Waiting on {undecided.length}{" "}
          {undecided.length === 1 ? "vote" : "votes"}: {undecided.map(nameOf).join(", ")}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit || isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Recording…" : "Record Vote"}
      </Button>
    </form>
  );
}
