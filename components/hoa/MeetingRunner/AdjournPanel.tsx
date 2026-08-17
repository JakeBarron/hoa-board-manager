"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoverSeconderFields, useMoverSeconder } from "./MoverSeconder";
import type { Position } from "./types";

export interface AdjournPanelProps {
  /** Voting positions marked present. */
  presentPositions: Position[];
  /** True when the minutes are still an untouched scaffold. */
  minutesLookEmpty: boolean;
  onAdjourn: (movedBy: string, secondedBy: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

/**
 * Collects who moved and seconded adjournment, then closes the meeting.
 *
 * Warns when the minutes still look untouched: adjourning is irreversible and
 * leaves a meeting in the permanent record with no account of what happened.
 * The warning is advisory — a board that genuinely met without minutes can still
 * close out.
 *
 * A real `<form>`, so Enter from either select adjourns.
 *
 * @param presentPositions - Voting positions available to move or second
 * @param minutesLookEmpty - Whether to show the empty-minutes warning
 * @param onAdjourn        - Adjourns with the chosen pair
 * @param onCancel         - Returns to the running meeting
 * @param isPending        - True while adjournment is in flight
 */
export function AdjournPanel({
  presentPositions,
  minutesLookEmpty,
  onAdjourn,
  onCancel,
  isPending,
}: AdjournPanelProps) {
  const state = useMoverSeconder(presentPositions);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state.isComplete || isPending) return;
    onAdjourn(state.movedBy, state.secondedBy);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Adjourn Meeting</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who moved to adjourn and who seconded?
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>

      {minutesLookEmpty && (
        <p
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          No minutes have been written for this meeting yet. Adjourning now leaves
          it in the record with no account of what happened.
        </p>
      )}

      <div className="space-y-4">
        <MoverSeconderFields
          idPrefix="adjourn"
          moverLabel="Moved by"
          presentPositions={presentPositions}
          state={state}
        />
      </div>

      <Button
        type="submit"
        disabled={!state.isComplete || isPending}
        variant="destructive"
      >
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Adjourning…" : "Formally Adjourn"}
      </Button>
    </form>
  );
}
