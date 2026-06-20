"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addCRADocument, deleteCRADocument } from "@/actions/cra";
import { FileUploadButton } from "@/components/hoa/FileUploadButton";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Spinner } from "@/components/hoa/Spinner";
import { Button } from "@/components/ui/button";
import type { CRADocument } from "@/types/database";

interface CRADocumentsSectionProps {
  projectId: string;
  documents: CRADocument[];
  positionId: string;
  canEdit: boolean;
}

const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Document attachments for a CRA project. Supports uploading a file to the
 * 'documents' bucket or pasting an external URL. Editors can delete links.
 *
 * @param projectId  - Owning project UUID
 * @param documents  - Linked document rows
 * @param positionId - Current user's position UUID (for parity with DocumentUpload; currently unused)
 * @param canEdit    - Whether the current user may add/delete documents
 */
export function CRADocumentsSection(props: CRADocumentsSectionProps) {
  const { projectId, documents, canEdit } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!file && !url.trim()) {
      setError("Choose a file or paste a URL.");
      return;
    }

    startTransition(async () => {
      try {
        if (file) {
          const supabase = createClient();
          const path = `cra/${projectId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, file, { contentType: file.type });
          if (upErr) throw new Error(upErr.message);
          await addCRADocument(projectId, name.trim(), path, "storage_file");
        } else {
          await addCRADocument(projectId, name.trim(), url.trim(), "google_doc");
        }
        setName("");
        setUrl("");
        setFile(null);
        setResetKey((k) => k + 1);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  };

  const open = (doc: CRADocument) =>
    startTransition(async () => {
      if (doc.url_type === "google_doc") {
        window.open(doc.url, "_blank");
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.storage.from("documents").createSignedUrl(doc.url, 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    });

  const remove = (id: string) =>

    startTransition(async () => {
      await deleteCRADocument(id);
      setDeleteId(null);
      router.refresh();
    });

  return (
    <div className="space-y-4" aria-busy={isPending}>
      {isPending && <Spinner label="Saving…" />}
      <div className={`space-y-4 transition-opacity ${isPending ? "pointer-events-none opacity-50" : ""}`}>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <button
                type="button"
                className="text-primary underline"
                onClick={() => open(d)}
                disabled={isPending}
              >
                {d.name}
              </button>
              {canEdit &&
                (deleteId === d.id ? (
                  <InlineConfirm
                    message="Remove?"
                    confirmLabel="Remove"
                    onConfirm={() => remove(d.id)}
                    onDismiss={() => setDeleteId(null)}
                    isPending={isPending}
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => setDeleteId(d.id)}
                  >
                    Remove
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-border p-3">
          <input
            className={input}
            placeholder="Document name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
          <FileUploadButton
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
            label="Choose file"
            onChange={(files) => setFile(files[0] ?? null)}
            disabled={isPending}
            resetKey={resetKey}
          />
          <input
            className={input}
            placeholder="…or paste a URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isPending}
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Add document"}
          </Button>
        </form>
      )}
      </div>
    </div>
  );
}
