"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import type { DocumentType } from "@/types/database";

const TYPE_LABELS: Record<DocumentType, string> = {
  waiver: "Waiver",
  contract: "Contract",
  other: "Other",
};

interface DocumentUploadProps {
  /** UUID of the position performing the upload */
  positionId: string;
}

/**
 * Inline file upload form for the document library.
 * Uploads the file directly to Supabase Storage from the browser, then
 * records the path via the saveDocument server action.
 *
 * @param positionId - UUID of the uploading board member's position
 */
export function DocumentUpload({ positionId }: DocumentUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for this document.");
      return;
    }
    if (!file) {
      setError("Please select a file.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const year = new Date().getFullYear();
        const storagePath = `${type}/${year}/${crypto.randomUUID()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, { contentType: file.type });

        if (uploadError) throw new Error(uploadError.message);

        await saveDocument(type, name.trim(), storagePath, positionId);

        setName("");
        setFile(null);
        setType("other");
        setIsOpen(false);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  };

  if (!isOpen) {
    return (
      <Button size="sm" onClick={() => setIsOpen(true)} variant="outline">
        + Upload Document
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border p-4">
      <div className="space-y-1.5">
        <label htmlFor="doc-name" className="text-sm font-medium">
          Name <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="doc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          placeholder="e.g. Pool Liability Waiver 2026"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="doc-type" className="text-sm font-medium">
          Type
        </label>
        <select
          id="doc-type"
          value={type}
          onChange={(e) => setType(e.target.value as DocumentType)}
          disabled={isPending}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          {(Object.keys(TYPE_LABELS) as DocumentType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="doc-file" className="text-sm font-medium">
          File <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="doc-file"
          type="file"
          accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={isPending}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload"}
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
