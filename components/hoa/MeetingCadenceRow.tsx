"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "@/actions/settings";
import { parseCadence, describeCadence } from "@/lib/dates";
import { Button } from "@/components/ui/button";

const WEEK_OPTIONS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "Last" },
];

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const SELECT_CLASS =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

interface MeetingCadenceRowProps {
  settingKey: string;
  description: string | null;
  /** Current cadence value from DB e.g. "3:2" */
  initialValue: string;
}

/**
 * Specialised settings row for the meeting_cadence setting.
 * Renders week-of-month and day-of-week dropdowns instead of a raw text input.
 * Stores the value as "week:dayOfWeek" (e.g. "3:2" = 3rd Tuesday).
 *
 * @param settingKey   - DB key ("meeting_cadence")
 * @param description  - Help text from settings.description
 * @param initialValue - Current stored cadence string
 */
export function MeetingCadenceRow({
  settingKey,
  description,
  initialValue,
}: MeetingCadenceRowProps) {
  const initial = parseCadence(initialValue) ?? { week: 3, dayOfWeek: 2 };
  const [week, setWeek] = useState(initial.week);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanged = week !== initial.week || dayOfWeek !== initial.dayOfWeek;

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const error = await updateSetting(settingKey, `${week}:${dayOfWeek}`);
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
          <p className="text-sm font-medium">Meeting Cadence</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Currently:{" "}
            <span className="font-medium text-foreground">
              {describeCadence(`${week}:${dayOfWeek}`)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={week}
            onChange={(e) => {
              setWeek(Number(e.target.value));
              setFeedback(null);
            }}
            className={SELECT_CLASS}
            disabled={isPending}
            aria-label="Week of month"
          >
            {WEEK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={dayOfWeek}
            onChange={(e) => {
              setDayOfWeek(Number(e.target.value));
              setFeedback(null);
            }}
            className={SELECT_CLASS}
            disabled={isPending}
            aria-label="Day of week"
          >
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !hasChanged}
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
