"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPersonName } from "@/lib/positions";
import type { PositionName } from "@/types/database";
import type { Position } from "./types";

export interface AttendancePanelProps {
  positions: Position[];
  presentIds: Set<string>;
  /** Threshold from `settings.quorum_required`. */
  quorumRequired: number;
  onToggle: (id: string) => void;
  onMarkAllPresent: () => void;
  onProceed: () => void;
  isPending: boolean;
}

/**
 * Attendance roll call, taken before call to order.
 *
 * Starts with nobody marked present. It used to default to everyone present,
 * which meant an operator who skipped this step recorded a full house that never
 * happened — and quorum was satisfied without anyone confirming it. "Mark all
 * present" keeps the common case to one tap while still making it a deliberate act.
 *
 * Quorum counts voting members only: committee chairs attend but do not count.
 *
 * @param positions        - Every position eligible to be marked present
 * @param presentIds       - Ids currently marked present
 * @param quorumRequired   - Number of voting members needed for quorum
 * @param onToggle         - Flips one position's attendance
 * @param onMarkAllPresent - Marks every listed position present
 * @param onProceed        - Advances to call to order
 * @param isPending        - True while an attendance write is in flight
 */
export function AttendancePanel({
  positions,
  presentIds,
  quorumRequired,
  onToggle,
  onMarkAllPresent,
  onProceed,
  isPending,
}: AttendancePanelProps) {
  const votingPresent = positions.filter(
    (p) => p.is_voting_member && presentIds.has(p.id)
  ).length;
  const quorumMet = votingPresent >= quorumRequired;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Attendance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark who is present before calling the meeting to order.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onMarkAllPresent}>
          Mark all present
        </Button>
      </div>

      <div className="rounded-md border border-border divide-y divide-border">
        {positions.map((p) => {
          const present = presentIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={present}
              onClick={() => onToggle(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors cursor-pointer ${
                present ? "bg-green-50 text-green-900" : "bg-background text-muted-foreground"
              }`}
            >
              <span className="font-medium">
                {formatPersonName(p.name as PositionName, p.display_name)}
              </span>
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
        <p className={`text-sm font-medium ${quorumMet ? "text-green-700" : "text-amber-700"}`}>
          {votingPresent} voting {votingPresent === 1 ? "member" : "members"} present — quorum:{" "}
          {quorumRequired}
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
