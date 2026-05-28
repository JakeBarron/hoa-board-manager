"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Adds a new todo for the given board position.
 * Security enforced by RLS — insert is rejected if the current user
 * is not the position owner or an officer/president.
 *
 * @param positionId - UUID of the position that owns this todo
 * @param formData   - Form data; reads the 'title' field
 */
export async function addTodo(
  positionId: string,
  formData: FormData
): Promise<void> {
  const title = formData.get("title");
  if (typeof title !== "string" || !title.trim()) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .insert({ position_id: positionId, title: title.trim() });

  if (error) throw new Error(error.message);
  revalidatePath("/board", "layout");
}

/**
 * Toggles the completed state of a todo item.
 * Fetches the current state server-side to avoid stale client data.
 * Security enforced by RLS.
 *
 * @param todoId - UUID of the todo to toggle
 */
export async function toggleTodo(todoId: string): Promise<void> {
  const supabase = await createClient();

  const { data: todo, error: fetchError } = await supabase
    .from("todos")
    .select("completed")
    .eq("id", todoId)
    .single();

  if (fetchError || !todo) throw new Error("Todo not found");

  const { error } = await supabase
    .from("todos")
    .update({ completed: !todo.completed })
    .eq("id", todoId);

  if (error) throw new Error(error.message);
  revalidatePath("/board", "layout");
}

/**
 * Permanently deletes a todo item.
 * Security enforced by RLS — only the owning position or officer+ can delete.
 *
 * @param todoId - UUID of the todo to delete
 */
export async function deleteTodo(todoId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("todos").delete().eq("id", todoId);

  if (error) throw new Error(error.message);
  revalidatePath("/board", "layout");
}
