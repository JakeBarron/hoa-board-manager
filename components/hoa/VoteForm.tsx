"use client";

import { useState, useTransition } from "react";
import { recordVote } from "@/actions/architecture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { VoteOutcome } from "@/types/database";

interface VoteFormProps {
  /** UUID of the architecture request being voted on */
  requestId: string;
}

/** Vote outcome options with human-readable labels */
const OUTCOME_OPTIONS: { value: VoteOutcome; label: string }[] = [
  { value: "unanimous", label: "Unanimous" },
  { value: "majority", label: "Majority" },
  { value: "denied", label: "Denied" },
];

/**
 * Inline form for the president to record a board vote on an architecture request.
 * Shows a toggle button; expands to the form on click.
 * Submits via the `recordVote` server action and collapses on success.
 *
 * @param requestId - UUID of the architecture request to vote on
 */
export function VoteForm({ requestId }: VoteFormProps) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<VoteOutcome | "">("");
  const [ratio, setRatio] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setOutcome("");
    setRatio("");
    setNotes("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!outcome) {
      setError("Please select a vote outcome.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordVote(requestId, outcome, ratio, notes);
        setOpen(false);
        reset();
      } catch {
        setError("Failed to record vote. Please try again.");
      }
    });
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Record vote"
      >
        Record vote
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
      aria-label="Vote form"
    >
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`outcome-${requestId}`}
          className="text-sm font-medium"
        >
          Vote outcome{" "}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </Label>
        {/* Native select — styled to match the app's input tokens */}
        <select
          id={`outcome-${requestId}`}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as VoteOutcome | "")}
          disabled={isPending}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select outcome…</option>
          {OUTCOME_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`ratio-${requestId}`}
          className="text-sm font-medium"
        >
          Vote ratio
        </Label>
        <Input
          id={`ratio-${requestId}`}
          placeholder="e.g. 5-2"
          value={ratio}
          onChange={(e) => setRatio(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`notes-${requestId}`}
          className="text-sm font-medium"
        >
          Notes
        </Label>
        <Textarea
          id={`notes-${requestId}`}
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          className="min-h-12"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save vote"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
