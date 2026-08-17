"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { NewBusinessItem } from "@/lib/agenda";

export interface NewBusinessPanelProps {
  items: NewBusinessItem[];
  onAdd: (item: NewBusinessItem) => void;
  onRemove: (index: number) => void;
  onContinue: () => void;
}

/**
 * First step of the start wizard: the operator lists anything new to discuss.
 * Items fold into the agenda scaffold under "New Business" when the meeting is
 * called to order. Skippable — continue with zero items if there is nothing new.
 *
 * The entry fields are a real `<form>`, so Enter adds an item. Continue sits
 * outside it: it advances the wizard rather than adding anything.
 *
 * @param items      - New-business items entered so far
 * @param onAdd      - Appends an item
 * @param onRemove   - Removes the item at the given index
 * @param onContinue - Advances to attendance
 */
export function NewBusinessPanel({
  items,
  onAdd,
  onRemove,
  onContinue,
}: NewBusinessPanelProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), note: note.trim() || null });
    setTitle("");
    setNote("");
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <h2 className="text-xl font-semibold">New Business</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          List anything new to discuss at this meeting. These appear on the agenda.
          You can skip this if there is nothing new.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="rounded-md border border-border divide-y divide-border">
          {items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRemove(i)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="nb-title" className="text-sm font-medium">
            Topic
          </label>
          <input
            id="nb-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fence vendor quote"
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nb-note" className="text-sm font-medium">
            Note (optional)
          </label>
          <input
            id="nb-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. review 3 bids"
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={!title.trim()}>
          Add item
        </Button>
      </form>

      <div className="flex justify-end">
        <Button onClick={onContinue}>
          {items.length > 0 ? "Continue to Attendance" : "Skip — no new business"}
        </Button>
      </div>
    </div>
  );
}
