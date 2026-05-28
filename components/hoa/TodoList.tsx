"use client";

import { useTransition } from "react";
import { addTodo, toggleTodo, deleteTodo } from "@/actions/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Todo } from "@/types/database";

interface TodoListProps {
  todos: Todo[];
  positionId: string;
  /** When false, renders read-only — no add, toggle, or delete controls. */
  canEdit: boolean;
}

/**
 * Interactive todo list for a board position.
 * Renders an add form and per-item toggle/delete when canEdit is true.
 * Uses useTransition so UI stays responsive during server action round-trips.
 *
 * @param todos      - Current todos for this position, sorted by created_at
 * @param positionId - Position UUID used when inserting new todos
 * @param canEdit    - Whether the current user may mutate this list
 */
export function TodoList({ todos, positionId, canEdit }: TodoListProps) {
  const [isPending, startTransition] = useTransition();
  const boundAddTodo = addTodo.bind(null, positionId);

  const handleToggle = (todoId: string) => {
    startTransition(() => toggleTodo(todoId));
  };

  const handleDelete = (todoId: string) => {
    startTransition(() => deleteTodo(todoId));
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          action={boundAddTodo}
          className="flex gap-2"
          onSubmit={(e) => {
            // Reset the input after submit so the user can add another immediately
            const input = e.currentTarget.querySelector("input");
            if (input) setTimeout(() => (input.value = ""), 0);
          }}
        >
          <Input
            name="title"
            placeholder="Add a to-do…"
            required
            disabled={isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={isPending}>
            Add
          </Button>
        </form>
      )}

      {todos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No to-dos yet.</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={todo.completed}
                disabled={!canEdit || isPending}
                onChange={() => handleToggle(todo.id)}
                className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-default"
                aria-label={`Mark "${todo.title}" as ${todo.completed ? "incomplete" : "complete"}`}
              />
              <span
                className={
                  todo.completed
                    ? "flex-1 text-sm line-through text-muted-foreground"
                    : "flex-1 text-sm"
                }
              >
                {todo.title}
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(todo.id)}
                  aria-label={`Delete "${todo.title}"`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
