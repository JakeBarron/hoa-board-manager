"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { submitPreMeetingUpdate } from "@/actions/pre-meeting";
import { Button } from "@/components/ui/button";

const schema = z.object({
  content: z.string().min(1, "Please enter your update before submitting."),
});

type FormValues = z.infer<typeof schema>;

interface PreMeetingFormProps {
  positionId: string;
  /** The NEXT meeting's id, or null when nothing is scheduled yet. */
  meetingId: string | null;
  /**
   * When the position has already submitted for this meeting the server passes
   * the existing content so we show the success/edit view immediately.
   */
  existingContent?: string;
  /** When true and no meeting is scheduled, show a link to schedule one. */
  canSchedule?: boolean;
}

/**
 * Form for submitting a pre-meeting status update for the single upcoming
 * ("NEXT") meeting. There is no date picker — everyone targets the same meeting,
 * and the update is keyed to that meeting so it survives a reschedule. When no
 * meeting is scheduled, an empty state is shown instead.
 *
 * @param positionId      - UUID of the owning position
 * @param meetingId       - The NEXT meeting's id, or null if none scheduled
 * @param existingContent - Existing update text for pre-population on load
 * @param canSchedule     - Whether to offer a "schedule a meeting" link in the empty state
 */
export function PreMeetingForm({
  positionId,
  meetingId,
  existingContent,
  canSchedule,
}: PreMeetingFormProps) {
  const [isPending, startTransition] = useTransition();
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

  const onSubmit = (values: FormValues) => {
    if (!meetingId) return;
    startTransition(async () => {
      await submitPreMeetingUpdate(positionId, meetingId, values.content);
      setSavedContent(values.content);
    });
  };

  if (!meetingId) {
    return (
      <p className="text-sm text-muted-foreground">
        No meeting is scheduled yet.{" "}
        {canSchedule && (
          <Link href="/meetings" className="font-medium text-primary underline hover:no-underline">
            Schedule a meeting →
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {savedContent !== null ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-green-700">✓ Submitted</p>
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
            aria-label="Your pre-meeting update"
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
