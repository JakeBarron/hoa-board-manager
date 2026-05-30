"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface InlineDateInputProps {
  defaultValue?: string;
  minDate?: string;
  onSave: (date: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

/**
 * Inline date editor with Save and Cancel buttons.
 * Client-side validates that the selected date is non-empty and >= minDate
 * before calling onSave. Defaults minDate to tomorrow if not provided.
 *
 * @param defaultValue - Pre-filled date value (YYYY-MM-DD)
 * @param minDate      - Earliest selectable date (YYYY-MM-DD); defaults to tomorrow
 * @param onSave       - Called with the selected ISO date string when saved
 * @param onCancel     - Called when the user cancels
 * @param isPending    - Disables all controls while an action is in flight
 */
export function InlineDateInput({
  defaultValue = "",
  minDate,
  onSave,
  onCancel,
  isPending = false,
}: InlineDateInputProps) {
  const [value, setValue] = useState(defaultValue);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const effectiveMin = minDate ?? tomorrow.toISOString().split("T")[0];

  const isValid = Boolean(value) && value >= effectiveMin;

  return (
    <div className="flex items-center gap-2 py-2 px-1">
      <input
        type="date"
        value={value}
        min={effectiveMin}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        size="sm"
        onClick={() => onSave(value)}
        disabled={!isValid || isPending}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
        Cancel
      </Button>
    </div>
  );
}
