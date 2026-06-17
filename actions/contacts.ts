"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Shape of the editable fields on a contact. */
interface ContactInput {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
}

/**
 * Normalizes a contact input: trims the name and converts empty optional
 * fields to null so blank inputs don't store empty strings.
 *
 * @param input - The raw contact field values from the form
 */
function normalize(input: ContactInput) {
  return {
    name: input.name.trim(),
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    category: input.category?.trim() || null,
  };
}

/**
 * Creates a new committee/directory contact.
 * Open to any authenticated user (intentionally collaborative — each section
 * maintains its own contacts). RLS enforces authentication at the DB layer.
 *
 * @param input - The contact's name (required) plus optional title/email/phone/category
 * @returns An error message string on failure, undefined on success
 */
export async function addContact(input: ContactInput): Promise<string | undefined> {
  const fields = normalize(input);
  if (!fields.name) return "Name is required.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  const { error } = await supabase.from("contacts").insert(fields);
  if (error) return error.message;

  revalidatePath("/directory", "layout");
}

/**
 * Updates an existing contact's fields.
 * Open to any authenticated user (see addContact).
 *
 * @param id    - The contact row UUID
 * @param input - The new field values
 * @returns An error message string on failure, undefined on success
 */
export async function updateContact(
  id: string,
  input: ContactInput
): Promise<string | undefined> {
  const fields = normalize(input);
  if (!fields.name) return "Name is required.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  const { error } = await supabase.from("contacts").update(fields).eq("id", id);
  if (error) return error.message;

  revalidatePath("/directory", "layout");
}

/**
 * Deletes a contact.
 * Open to any authenticated user (see addContact).
 *
 * @param id - The contact row UUID
 * @returns An error message string on failure, undefined on success
 */
export async function deleteContact(id: string): Promise<string | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return error.message;

  revalidatePath("/directory", "layout");
}
