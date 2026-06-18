"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContact } from "@/actions/contacts";

/**
 * Collapsed "Add contact" button that expands into a form for a new
 * committee/directory contact. Open to all authenticated users.
 * Resets and collapses on a successful save.
 */
export function ContactAddForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setCategory("");
    setError(null);
  };

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await addContact({
        name,
        title: title || null,
        email: email || null,
        phone: phone || null,
        category: category || null,
      });
      if (result) {
        setError(result);
      } else {
        reset();
        setOpen(false);
      }
    });
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add contact
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          disabled={isPending}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title / role"
          aria-label="Title"
          disabled={isPending}
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          disabled={isPending}
        />
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          aria-label="Phone"
          disabled={isPending}
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Group (e.g. CRA)"
          aria-label="Group"
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
