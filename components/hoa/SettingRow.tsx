"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingRowProps {
  /** The setting key stored in the DB */
  settingKey: string;
  /** Human-readable label derived from the key */
  label: string;
  /** Help text from the settings.description column */
  description: string | null;
  /** Current value from the DB */
  initialValue: string;
}

/**
 * Editable row for a single configurable setting.
 * Displays the current value in a text input; saves on button click.
 * Shows inline success/error feedback without a full page reload.
 *
 * @param settingKey   - DB key used to identify the setting
 * @param label        - Display label shown above the input
 * @param description  - Help text shown below the label
 * @param initialValue - Current value loaded from the DB
 */
export function SettingRow({
  settingKey,
  label,
  description,
  initialValue,
}: SettingRowProps) {
  const [value, setValue] = useState(initialValue);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const error = await updateSetting(settingKey, value);
      setFeedback(
        error
          ? { ok: false, message: error }
          : { ok: true, message: "Saved." }
      );
    });
  };

  return (
    <div className="flex flex-col gap-1.5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setFeedback(null);
            }}
            className="w-32 text-sm"
            disabled={isPending}
            aria-label={label}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || value === initialValue}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {feedback && (
        <p
          className={`text-xs ${feedback.ok ? "text-green-700" : "text-destructive"}`}
        >
          {feedback.ok ? "✓ " : ""}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
