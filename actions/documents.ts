"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DocumentType } from "@/types/database";

/**
 * Records a document that has already been uploaded to Supabase Storage.
 * All authenticated board members and chairs can upload documents.
 *
 * @param type        - Document category (waiver | contract | other)
 * @param name        - Human-readable display name
 * @param storagePath - Path in the 'documents' Supabase Storage bucket
 * @param positionId  - UUID of the position uploading the document
 * @returns The newly created document row ID
 */
export async function saveDocument(
  type: DocumentType,
  name: string,
  storagePath: string,
  positionId: string
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .insert({ type, name, storage_path: storagePath, position_id: positionId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/documents");
  return { id: data.id };
}

/**
 * Deletes a document record and removes the file from Supabase Storage.
 * Only officers and the president can delete — enforced by RLS.
 *
 * @param id          - UUID of the document row to delete
 * @param storagePath - Storage path to remove from the bucket
 */
export async function deleteDocument(
  id: string,
  storagePath: string
): Promise<void> {
  const supabase = await createClient();

  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (dbError) throw new Error(dbError.message);

  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([storagePath]);

  if (storageError) throw new Error(`Document deleted but file removal failed: ${storageError.message}`);

  revalidatePath("/documents");
}
