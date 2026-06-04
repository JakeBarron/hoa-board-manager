"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { saveMinutes } from "@/actions/minutes";
import { RichTextEditor } from "@/components/hoa/RichTextEditor";
import { FormField } from "@/components/hoa/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  meetingDate: z.string().min(1, "Meeting date is required"),
  content: z.string().min(1, "Minutes content cannot be empty"),
});

type FormValues = z.infer<typeof schema>;

interface MinutesFormProps {
  positionId: string;
  /** Slug of the position — used for navigation after save */
  positionSlug: string;
}

/**
 * Form for creating new board meeting minutes.
 * Saves the HTML content to the DB and auto-uploads a .docx to Supabase Storage.
 * After saving, the user can download the .docx directly or navigate back to minutes.
 *
 * @param positionId   - UUID of the owning position (inserted into DB)
 * @param positionSlug - URL slug used to build the back-to-minutes link
 */
export function MinutesForm({ positionId, positionSlug }: MinutesFormProps) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const { id } = await saveMinutes(
        positionId,
        values.meetingDate,
        values.content
      );
      setSavedId(id);
    });
  };

  if (savedId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-green-700 font-medium">
          ✓ Minutes saved to Documents.
        </p>
        <div className="flex gap-3 text-sm">
          <a
            href={`/api/minutes/${savedId}/export`}
            className="text-primary underline underline-offset-2"
          >
            Download .docx
          </a>
          <a
            href={`/board/${positionSlug}/minutes`}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Back to minutes
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormField label="Meeting date" htmlFor="meeting-date" error={errors.meetingDate?.message}>
        <Input
          id="meeting-date"
          type="date"
          {...register("meetingDate")}
          className="w-48"
        />
      </FormField>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Minutes</label>
        {errors.content && (
          <p className="text-xs text-destructive">{errors.content.message}</p>
        )}
        <RichTextEditor
          onChange={(html) => setValue("content", html, { shouldValidate: true })}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save minutes"}
      </Button>
    </form>
  );
}
