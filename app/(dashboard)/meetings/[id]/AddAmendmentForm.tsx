"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { addMeetingDocument } from "@/actions/meetings";

interface AddAmendmentFormProps {
  /** UUID of the meeting this amendment belongs to */
  meetingId: string;
  /** The next amendment number (1-indexed, based on existing amendments) */
  nextAmendmentNumber: number;
}

/**
 * Small inline form for uploading a numbered amendment file to an existing meeting.
 * Uploads directly to Supabase Storage from the browser, then records the storage path
 * via the addMeetingDocument server action. Only rendered for officer+ roles.
 *
 * @param meetingId           - UUID of the parent meeting
 * @param nextAmendmentNumber - Pre-filled suggested amendment number
 */
export function AddAmendmentForm({
  meetingId,
  nextAmendmentNumber,
}: AddAmendmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [amendmentNumber, setAmendmentNumber] = useState(
    String(nextAmendmentNumber)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for this amendment.");
      return;
    }
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    const num = parseInt(amendmentNumber, 10);
    if (isNaN(num) || num < 1) {
      setError("Amendment number must be a positive integer.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "docx";
        const storagePath = `minutes/amendments/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, { contentType: file.type });

        if (uploadError) throw new Error(uploadError.message);

        await addMeetingDocument(meetingId, name.trim(), storagePath, "amendment", num);
        setSuccess(true);
        setName("");
        setFile(null);
        setIsOpen(false);
        router.refresh();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to save amendment.";
        setError(message);
      }
    });
  };

  if (!isOpen) {
    return (
      <div className="space-y-2">
        {success && (
          <p className="text-sm text-green-700">Amendment saved successfully.</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSuccess(false);
            setIsOpen(true);
          }}
        >
          + Add Amendment
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="amendment-name" className="text-sm font-medium">
          Amendment name{" "}
          <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="amendment-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          placeholder="e.g. Amendment #1 — Corrected vote tally"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="amendment-file" className="text-sm font-medium">
          File{" "}
          <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="amendment-file"
          type="file"
          accept=".pdf,.docx,.doc"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={isPending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="amendment-number" className="text-sm font-medium">
          Amendment number
        </label>
        <input
          id="amendment-number"
          type="number"
          min={1}
          value={amendmentNumber}
          onChange={(e) => setAmendmentNumber(e.target.value)}
          disabled={isPending}
          className="h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Uploading…" : "Save amendment"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
