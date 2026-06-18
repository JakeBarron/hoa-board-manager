"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePosition } from "@/actions/positions";
import { POSITION_LABELS } from "@/lib/positions";
import type { PositionName } from "@/types/database";

interface PositionEditRowProps {
  position: {
    id: string;
    name: PositionName;
    role: string;
    email: string;
    display_name: string | null;
    phone: string | null;
  };
}

/**
 * Editable row for a single board position.
 * Idle view shows the display name (or "Not set") and email.
 * Edit view has inputs for both fields plus Save/Cancel.
 * When the email changes, a password reset is auto-sent to the new address.
 *
 * @param position - The full position row from the DB
 */
export function PositionEditRow({ position }: PositionEditRowProps) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(position.display_name ?? "");
  const [email, setEmail] = useState(position.email);
  const [phone, setPhone] = useState(position.phone ?? "");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailChanged = email.trim().toLowerCase() !== position.email.toLowerCase();

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const error = await updatePosition(position.id, {
        display_name: displayName.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
      });
      if (error) {
        setFeedback({ ok: false, message: error });
      } else {
        setFeedback({
          ok: true,
          message: emailChanged
            ? "Saved. Password reset sent to new address."
            : "Saved.",
        });
        setEditing(false);
      }
    });
  };

  const handleCancel = () => {
    setDisplayName(position.display_name ?? "");
    setEmail(position.email);
    setPhone(position.phone ?? "");
    setFeedback(null);
    setEditing(false);
  };

  const title = POSITION_LABELS[position.name];

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {!editing && (
            <p className="text-xs text-muted-foreground">
              {position.display_name ? (
                position.display_name
              ) : (
                <span className="italic">No name set</span>
              )}{" "}
              · {position.email}
              {position.phone ? ` · ${position.phone}` : ""}
            </p>
          )}
        </div>

        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={`name-${position.id}`} className="text-xs font-medium text-muted-foreground">
                Display name
              </label>
              <Input
                id={`name-${position.id}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jake Barron"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`email-${position.id}`} className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <Input
                id={`email-${position.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`phone-${position.id}`} className="text-xs font-medium text-muted-foreground">
                Phone
              </label>
              <Input
                id={`phone-${position.id}`}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
                disabled={isPending}
              />
            </div>
          </div>

          {emailChanged && (
            <p className="text-xs text-amber-700">
              A password reset will be sent to the new address when you save.
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={`text-xs ${feedback.ok ? "text-green-700" : "text-destructive"}`}>
          {feedback.ok ? "✓ " : ""}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
