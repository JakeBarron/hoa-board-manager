"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoverSeconderFields, useMoverSeconder } from "./MoverSeconder";
import type { Position } from "./types";

export interface CallToOrderPanelProps {
  /** Voting positions marked present. */
  presentPositions: Position[];
  onConfirm: (calledBy: string, secondedBy: string) => void;
  onBack: () => void;
  isPending: boolean;
}

/**
 * Collects who called the meeting to order and who seconded, then starts it.
 *
 * A real `<form>`, so Enter from either select starts the meeting.
 *
 * @param presentPositions - Voting positions available to move or second
 * @param onConfirm        - Starts the meeting with the chosen pair
 * @param onBack           - Returns to attendance
 * @param isPending        - True while the start request is in flight
 */
export function CallToOrderPanel({
  presentPositions,
  onConfirm,
  onBack,
  isPending,
}: CallToOrderPanelProps) {
  const state = useMoverSeconder(presentPositions);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state.isComplete || isPending) return;
    onConfirm(state.movedBy, state.secondedBy);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8"
    >
      <div>
        <h2 className="text-xl font-semibold">Call to Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who called the meeting to order and who seconded?
        </p>
      </div>

      <div className="space-y-4">
        <MoverSeconderFields
          idPrefix="call-to-order"
          moverLabel="Called by"
          presentPositions={presentPositions}
          state={state}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button type="submit" disabled={!state.isComplete || isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Starting…" : "Start Meeting"}
        </Button>
      </div>
    </form>
  );
}
