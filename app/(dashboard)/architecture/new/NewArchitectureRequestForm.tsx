"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createArchitectureRequest } from "@/actions/architecture";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { FileUploadButton } from "@/components/hoa/FileUploadButton";
import { Button } from "@/components/ui/button";
import type { ArchitectureDocType } from "@/types/database";

const DOC_TYPE_LABELS: Record<ArchitectureDocType, string> = {
  form: "Form",
  plan: "Plan / Drawing",
  sample: "Material Sample",
  other: "Other",
};

interface FileEntry {
  file: File;
  docType: ArchitectureDocType;
}

/**
 * Client form for submitting a homeowner's architecture request. Uploads supporting
 * documents to Supabase Storage client-side, then calls createArchitectureRequest to
 * persist the request and document rows. Access is gated by the parent server page.
 */
export function NewArchitectureRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (files: File[]) => {
    const newEntries = files.map((file) => ({
      file,
      docType: "other" as ArchitectureDocType,
    }));
    setFileEntries((prev) => [...prev, ...newEntries]);
  };

  const updateDocType = (index: number, docType: ArchitectureDocType) => {
    setFileEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, docType } : entry))
    );
  };

  const removeFile = (index: number) => {
    setFileEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("Property address is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const requestId = crypto.randomUUID();
      const storagePaths: string[] = [];

      try {
        // Upload all files in parallel; upsert:true avoids collisions on duplicate filenames
        const results = await Promise.all(
          fileEntries.map((entry) => {
            const storagePath = `architecture/${requestId}/${entry.file.name}`;
            storagePaths.push(storagePath);
            return supabase.storage
              .from("documents")
              .upload(storagePath, entry.file, {
                contentType: entry.file.type,
                upsert: true,
              })
              .then(({ error }) => {
                if (error) throw new Error(`Upload failed: ${error.message}`);
                return { storagePath, fileName: entry.file.name, docType: entry.docType };
              });
          })
        );

        await createArchitectureRequest(address.trim(), description.trim(), results);
        router.push("/architecture");
      } catch (err: unknown) {
        // Best-effort cleanup of any files that were uploaded before the failure
        if (storagePaths.length > 0) {
          await supabase.storage.from("documents").remove(storagePaths);
        }
        setError(err instanceof Error ? err.message : "Failed to submit request.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Architecture Request"
        subtitle="Submit a homeowner's architecture or modification request for board review."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Request Details">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="address" className="text-sm font-medium">
                Property address <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isPending}
                placeholder="123 Lakeview Drive"
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={4}
                placeholder="Describe what the homeowner wants to build or modify…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Supporting Documents">
          <div className="space-y-4">
            <FileUploadButton
              accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
              label="Add Files"
              onChange={addFiles}
              multiple
              disabled={isPending}
            />

            {fileEntries.length > 0 && (
              <ul className="divide-y divide-border">
                {fileEntries.map((entry, index) => (
                  <li key={index} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1 truncate text-sm">{entry.file.name}</span>
                    <select
                      value={entry.docType}
                      onChange={(e) =>
                        updateDocType(index, e.target.value as ArchitectureDocType)
                      }
                      disabled={isPending}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    >
                      {(Object.keys(DOC_TYPE_LABELS) as ArchitectureDocType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {DOC_TYPE_LABELS[type]}
                          </option>
                        )
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={isPending}
                      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting…" : "Submit Request"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            nativeButton={false}
            render={<Link href="/architecture" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
