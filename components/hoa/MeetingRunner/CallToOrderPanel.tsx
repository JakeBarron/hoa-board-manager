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

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
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

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button
          onClick={() => onConfirm(state.movedBy, state.secondedBy)}
          disabled={!state.isComplete || isPending}
        >
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Starting…" : "Start Meeting"}
        </Button>
      </div>
    </div>
  );
}
