"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { saveMinutes, updateMinutesDriveUrl } from "@/actions/minutes";
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
  /** Slug of the position — used for routing after save */
  positionSlug: string;
}

/**
 * Form for creating new board meeting minutes.
 * Handles the three-step flow: write → save → export to DOCX.
 * After export, the user uploads to Google Drive and pastes the URL here.
 *
 * @param positionId   - UUID of the owning position (inserted into DB)
 * @param positionSlug - URL slug used to build the Drive-URL update route
 */
export function MinutesForm({ positionId, positionSlug }: MinutesFormProps) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveSaved, setDriveSaved] = useState(false);
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

  const handleSaveDriveUrl = () => {
    if (!savedId || !driveUrl.trim()) return;
    startTransition(async () => {
      await updateMinutesDriveUrl(savedId, driveUrl.trim());
      setDriveSaved(true);
    });
  };

  if (savedId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-green-700 font-medium">
          ✓ Minutes saved successfully.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Export & upload to Google Drive</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              <a
                href={`/api/minutes/${savedId}/export`}
                className="text-primary underline underline-offset-2"
              >
                Download the .docx file
              </a>
            </li>
            <li>Upload it to the HOA Google Drive folder</li>
            <li>Paste the shareable link below</li>
          </ol>
        </div>

        {!driveSaved ? (
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSaveDriveUrl}
              disabled={isPending || !driveUrl.trim()}
            >
              Save link
            </Button>
          </div>
        ) : (
          <p className="text-sm text-green-700 font-medium">
            ✓ Drive link saved.{" "}
            <a
              href={`/board/${positionSlug}/minutes`}
              className="text-primary underline underline-offset-2"
            >
              Back to minutes
            </a>
          </p>
        )}
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
