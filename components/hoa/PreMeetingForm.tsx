"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { submitPreMeetingUpdate } from "@/actions/pre-meeting";
import { FormField } from "@/components/hoa/FormField";
import { Button } from "@/components/ui/button";
import { formatMeetingDate } from "@/lib/dates";

const schema = z.object({
  content: z.string().min(1, "Please enter your update before submitting."),
});

type FormValues = z.infer<typeof schema>;

interface PreMeetingFormProps {
  positionId: string;
  /** ISO date string (YYYY-MM-DD) for the currently selected meeting */
  selectedDate: string;
  /** Quick-select Monday options shown above the textarea */
  upcomingMondays: string[];
  /**
   * When the user has already submitted for this date the server passes the
   * existing content so we can show the success/edit view immediately.
   */
  existingContent?: string;
  /** Route to navigate to on date change. Defaults to /pre-meeting (for officers/president). */
  returnPath?: string;
}

/**
 * Form for submitting a pre-meeting status update.
 * Date selection navigates via URL search param so the server can pre-populate
 * any existing update for the chosen meeting. Submit upserts via server action.
 * Because date changes cause a full navigation (server re-render + remount),
 * useState initializes fresh on each date selection.
 *
 * @param positionId      - UUID of the owning position
 * @param selectedDate    - Currently active meeting date
 * @param upcomingMondays - ISO date strings for quick-select Monday buttons
 * @param existingContent - Existing update text for pre-population on load
 */
export function PreMeetingForm({
  positionId,
  selectedDate,
  upcomingMondays,
  existingContent,
  returnPath,
}: PreMeetingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Initialised from server data; resets on each navigation (component remounts)
  const [savedContent, setSavedContent] = useState<string | null>(
    existingContent ?? null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { content: existingContent ?? "" },
  });

  const handleDateSelect = (date: string) => {
    router.push(`${returnPath ?? "/pre-meeting"}?date=${date}`);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      await submitPreMeetingUpdate(positionId, selectedDate, values.content);
      setSavedContent(values.content);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground shrink-0">Meeting:</span>
        {upcomingMondays.map((date) => {
          const active = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              onClick={() => handleDateSelect(date)}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                active
                  ? "border-primary/40 bg-primary/8 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {formatMeetingDate(date)}
            </button>
          );
        })}
      </div>

      {savedContent !== null ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-green-700">
            ✓ Submitted for {formatMeetingDate(selectedDate)}
          </p>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
            {savedContent}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSavedContent(null)}
          >
            Edit
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <textarea
            id="pre-meeting-content"
            rows={3}
            placeholder="What did you accomplish? Any issues or vendor updates? Anything for the board to discuss?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            aria-label={`Your update for ${formatMeetingDate(selectedDate)}`}
            {...register("content")}
          />
          {errors.content?.message && (
            <p className="text-xs text-destructive">{errors.content.message}</p>
          )}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Submitting…" : existingContent ? "Update" : "Submit update"}
          </Button>
        </form>
      )}
    </div>
  );
}
