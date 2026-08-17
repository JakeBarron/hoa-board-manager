"use client";

import { useState } from "react";
import { formatPersonName } from "@/lib/positions";
import type { PositionName } from "@/types/database";
import type { Position } from "./types";

export interface MoverSeconderState {
  movedBy: string;
  secondedBy: string;
  setMovedBy: (id: string) => void;
  setSecondedBy: (id: string) => void;
  /** Present positions other than the mover — nobody seconds their own motion. */
  secondOptions: Position[];
  isComplete: boolean;
}

/**
 * Holds the "moved by / seconded by" pair used at call to order, on every
 * motion, and at adjournment.
 *
 * Keeps the two selections distinct: choosing a mover who is already the
 * seconder reassigns the seconder to the next available person, so the pair can
 * never collapse onto one person.
 *
 * @param presentPositions - Voting positions marked present, in display order
 */
export function useMoverSeconder(presentPositions: Position[]): MoverSeconderState {
  const [movedBy, setMovedByState] = useState(presentPositions[0]?.id ?? "");
  const [secondedBy, setSecondedBy] = useState(
    presentPositions[1]?.id ?? ""
  );

  const setMovedBy = (id: string) => {
    setMovedByState(id);
    if (secondedBy === id) {
      setSecondedBy(presentPositions.find((p) => p.id !== id)?.id ?? "");
    }
  };

  const secondOptions = presentPositions.filter((p) => p.id !== movedBy);

  return {
    movedBy,
    secondedBy,
    setMovedBy,
    setSecondedBy,
    secondOptions,
    isComplete: Boolean(movedBy) && Boolean(secondedBy) && movedBy !== secondedBy,
  };
}

export interface MoverSeconderFieldsProps {
  /** Distinguishes the two selects from any others on the same screen. */
  idPrefix: string;
  /** Label for the first select, e.g. "Called by" or "Moved by". */
  moverLabel: string;
  presentPositions: Position[];
  state: MoverSeconderState;
}

/**
 * Renders the mover/seconder select pair for a `useMoverSeconder` state.
 *
 * @param idPrefix         - Prefix for the generated input ids
 * @param moverLabel       - Label shown above the first select
 * @param presentPositions - Options for the mover select
 * @param state            - The state returned by `useMoverSeconder`
 */
export function MoverSeconderFields({
  idPrefix,
  moverLabel,
  presentPositions,
  state,
}: MoverSeconderFieldsProps) {
  const { movedBy, secondedBy, setMovedBy, setSecondedBy, secondOptions } = state;
  const optionLabel = (p: Position) =>
    formatPersonName(p.name as PositionName, p.display_name);

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-moved-by`} className="text-sm font-medium">
          {moverLabel} <span className="text-destructive">*</span>
        </label>
        <select
          id={`${idPrefix}-moved-by`}
          value={movedBy}
          onChange={(e) => setMovedBy(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {presentPositions.map((p) => (
            <option key={p.id} value={p.id}>
              {optionLabel(p)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-seconded-by`} className="text-sm font-medium">
          Seconded by <span className="text-destructive">*</span>
        </label>
        <select
          id={`${idPrefix}-seconded-by`}
          value={secondedBy}
          onChange={(e) => setSecondedBy(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {secondOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {optionLabel(p)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
