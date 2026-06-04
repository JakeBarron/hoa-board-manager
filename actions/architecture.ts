"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VoteOutcome, ArchitectureStatus, ArchitectureDocType } from "@/types/database";

/**
 * Maps a vote outcome to the resulting architecture request status.
 * Unanimous and majority votes approve the request; denied votes deny it.
 *
 * @param outcome - The vote outcome recorded by the president
 * @returns The corresponding architecture request status
 */
const outcomeToStatus = (outcome: VoteOutcome): ArchitectureStatus =>
  outcome === "unanimous" || outcome === "majority" ? "approved" : "denied";

/**
 * Records the board's vote on an architecture request and updates its status.
 * Only the president can call this action — enforced by RLS on the DB side.
 * Revalidates the architecture list and detail pages on success.
 *
 * @param requestId - UUID of the architecture request being voted on
 * @param outcome   - Vote outcome: unanimous | majority | denied
 * @param ratio     - Free-text vote ratio, e.g. "5-2"
 * @param notes     - Optional notes from the president
 * @throws Error if the Supabase update fails
 */
export async function recordVote(
  requestId: string,
  outcome: VoteOutcome,
  ratio: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("architecture_requests")
    .update({
      status: outcomeToStatus(outcome),
      vote_outcome: outcome,
      vote_ratio: ratio.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath("/architecture", "layout");
}

/**
 * Creates a new architecture request and records the already-uploaded document files.
 * Files must be uploaded to Supabase Storage before calling this action — only the
 * resulting storage paths are persisted here.
 *
 * @param address   - Homeowner's property address
 * @param description - Description of the requested modification
 * @param documents - Files already uploaded: storage path, file name, and doc type per file
 * @returns The newly created architecture request's ID
 */
export async function createArchitectureRequest(
  address: string,
  description: string,
  documents: { storagePath: string; fileName: string; docType: ArchitectureDocType }[]
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: position } = await supabase
    .from("positions")
    .select("id")
    .eq("email", user.email!)
    .single();

  if (!position) throw new Error("Position not found");

  const { data: request, error: requestError } = await supabase
    .from("architecture_requests")
    .insert({ address, description, created_by: position.id })
    .select("id")
    .single();

  if (requestError) throw new Error(requestError.message);

  if (documents.length > 0) {
    const docRows = documents.map((d) => ({
      request_id: request.id,
      storage_path: d.storagePath,
      file_name: d.fileName,
      doc_type: d.docType,
    }));
    const { error: docsError } = await supabase
      .from("architecture_documents")
      .insert(docRows);
    if (docsError) throw new Error(docsError.message);
  }

  revalidatePath("/architecture", "layout");
  return { id: request.id };
}
