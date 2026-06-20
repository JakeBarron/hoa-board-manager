"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Database,
  CRAProjectStatus,
  CRAPriority,
  DocumentUrlType,
} from "@/types/database";

interface CreateProjectInput {
  name: string;
  estimatedCost: number; // cents
  description?: string | null;
  category?: string | null;
  priority?: CRAPriority | null;
  targetDate?: string | null;
  fiscalYearId?: string | null;
  status?: CRAProjectStatus;
}

interface AddQuoteInput {
  projectId: string;
  vendorName: string;
  amount: number; // cents
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
}

/** Resolves the current user's position id, or throws if unauthenticated. */
async function currentPositionId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("positions")
    .select("id")
    .eq("email", user.email)
    .single();
  if (!data) throw new Error("No position for current user");
  return data.id;
}

/**
 * Creates a CRA project owned by the current user's position.
 * RLS rejects the insert unless the caller is a CRA editor.
 * @param input - Project fields; estimatedCost is integer cents
 * @returns The new project's id
 */
export async function createCRAProject(
  input: CreateProjectInput
): Promise<{ id: string }> {
  const supabase = await createClient();
  const createdBy = await currentPositionId(supabase);

  const { data, error } = await supabase
    .from("cra_projects")
    .insert({
      name: input.name.trim(),
      estimated_cost: input.estimatedCost,
      description: input.description ?? null,
      category: input.category ?? null,
      priority: input.priority ?? null,
      target_date: input.targetDate ?? null,
      fiscal_year_id: input.fiscalYearId ?? null,
      status: input.status ?? "proposed",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/cra");
  return { id: data.id };
}

/**
 * Patches a CRA project's editable fields. RLS enforces CRA-editor access.
 * @param id    - Project UUID
 * @param patch - Partial cra_projects Update
 */
export async function updateCRAProject(
  id: string,
  patch: Database["public"]["Tables"]["cra_projects"]["Update"]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra");
  revalidatePath(`/cra/${id}`);
}

/**
 * Deletes a CRA project (cascades to quotes/updates/documents via FK).
 * RLS enforces CRA-editor access.
 * @param id - Project UUID
 */
export async function deleteCRAProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra");
}

/**
 * Adds a vendor quote to a project. amount is integer cents.
 * @param input - Quote fields
 */
export async function addQuote(input: AddQuoteInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").insert({
    project_id: input.projectId,
    vendor_name: input.vendorName.trim(),
    amount: input.amount,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null,
    notes: input.notes ?? null,
    document_url: input.documentUrl ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${input.projectId}`);
}

/**
 * Patches a quote's fields. RLS enforces CRA-editor access.
 * @param id    - Quote UUID
 * @param patch - Partial cra_quotes Update
 */
export async function updateQuote(
  id: string,
  patch: Database["public"]["Tables"]["cra_quotes"]["Update"]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}

/**
 * Deletes a quote.
 * @param id - Quote UUID
 */
export async function deleteQuote(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}

/**
 * Marks one quote as the selected vendor and clears the others on the project.
 * Two ordered writes: clear all on the project, then set the chosen one.
 * Action-level enforcement is sufficient for a single-editor HOA board.
 * @param projectId - Project UUID
 * @param quoteId   - Quote UUID to select
 */
export async function selectQuote(
  projectId: string,
  quoteId: string
): Promise<void> {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("cra_quotes")
    .update({ is_selected: false })
    .eq("project_id", projectId);
  if (clearError) throw new Error(clearError.message);

  const { error: setError } = await supabase
    .from("cra_quotes")
    .update({ is_selected: true })
    .eq("id", quoteId);
  if (setError) throw new Error(setError.message);

  revalidatePath(`/cra/${projectId}`);
}

/**
 * Appends an immutable status update authored by the current user's position.
 * @param projectId - Project UUID
 * @param content   - Update text
 */
export async function addUpdate(
  projectId: string,
  content: string
): Promise<void> {
  if (!content.trim()) return;
  const supabase = await createClient();
  const createdBy = await currentPositionId(supabase);

  const { error } = await supabase.from("cra_updates").insert({
    project_id: projectId,
    content: content.trim(),
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${projectId}`);
}

/**
 * Links a document (uploaded storage path or pasted URL) to a project.
 * @param projectId - Project UUID
 * @param name      - Display name
 * @param url       - Storage path or external URL
 * @param urlType   - 'storage_file' or 'google_doc'
 */
export async function addCRADocument(
  projectId: string,
  name: string,
  url: string,
  urlType: DocumentUrlType
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_documents").insert({
    project_id: projectId,
    name: name.trim(),
    url,
    url_type: urlType,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/cra/${projectId}`);
}

/**
 * Removes a document link from a project (DB row only; storage cleanup
 * is out of scope for v1 — orphaned files are harmless in the private bucket).
 * @param id - Document UUID
 */
export async function deleteCRADocument(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cra_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cra", "layout");
}
