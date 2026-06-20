"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addUpdate } from "@/actions/cra";
import { Spinner } from "@/components/hoa/Spinner";
import { Button } from "@/components/ui/button";
import type { CRAUpdate } from "@/types/database";

type UpdateRow = CRAUpdate & { positions: { name: string } | null };

interface CRAUpdatesSectionProps {
  projectId: string;
  updates: UpdateRow[];
  canEdit: boolean;
}

/**
 * Immutable, chronological status-update log for a CRA project, newest first.
 * Editors can append updates; existing entries are never edited or deleted.
 *
 * @param projectId - Owning project UUID
 * @param updates   - Update rows with embedded author position name
 * @param canEdit   - Whether the current user may add updates
 */
export function CRAUpdatesSection({ projectId, updates, canEdit }: CRAUpdatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      await addUpdate(projectId, content);
      setContent("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4" aria-busy={isPending}>
      {isPending && <Spinner label="Posting…" />}
      {canEdit && (
        <form onSubmit={submit} className={`space-y-2 transition-opacity ${isPending ? "pointer-events-none opacity-50" : ""}`}>
          <textarea
            className="min-h-16 w-full rounded-md border border-input bg-background p-3 text-sm"
            placeholder="Add a status update…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPending}
          />
          <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
            {isPending ? "Posting…" : "Post update"}
          </Button>
        </form>
      )}

      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No updates yet.</p>
      ) : (
        <ul className="space-y-3">
          {updates.map((u) => (
            <li key={u.id} className="rounded-md border border-border p-3 text-sm">
              <p className="whitespace-pre-wrap">{u.content}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {u.positions?.name ?? "unknown"} · {new Date(u.created_at).toLocaleDateString("en-US")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
