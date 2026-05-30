"use client";

import { Button } from "@/components/ui/button";

export interface InlineConfirmProps {
  message: string;
  confirmLabel?: string;
  dismissLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}

/**
 * Inline confirmation strip for destructive actions.
 * Renders a message with Confirm and Dismiss buttons in a single row.
 *
 * @param message      - Text describing what will happen on confirm
 * @param confirmLabel - Label for the confirm button (default "Confirm")
 * @param dismissLabel - Label for the dismiss button (default "Dismiss")
 * @param onConfirm    - Called when the user confirms
 * @param onDismiss    - Called when the user dismisses
 * @param isPending    - Disables both buttons while an action is in flight
 */
export function InlineConfirm({
  message,
  confirmLabel = "Confirm",
  dismissLabel = "Dismiss",
  onConfirm,
  onDismiss,
  isPending = false,
}: InlineConfirmProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{message}</span>
      <Button
        size="sm"
        variant="destructive"
        onClick={onConfirm}
        disabled={isPending}
      >
        {confirmLabel}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDismiss}
        disabled={isPending}
      >
        {dismissLabel}
      </Button>
    </div>
  );
}
