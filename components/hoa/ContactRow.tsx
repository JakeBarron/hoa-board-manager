"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { updateContact, deleteContact } from "@/actions/contacts";
import type { Contact } from "@/types/database";

interface ContactRowProps {
  contact: Contact;
}

/**
 * Editable row for a single committee/directory contact.
 * Idle view shows name · title · email · phone with Edit/Delete.
 * Edit view exposes inputs for every field plus Save/Cancel.
 * Open to all authenticated users (RLS-enforced) — anyone can edit or delete.
 *
 * @param contact - The contact row from the DB
 */
export function ContactRow({ contact }: ContactRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(contact.name);
  const [title, setTitle] = useState(contact.title ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [category, setCategory] = useState(contact.category ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateContact(contact.id, {
        name,
        title: title || null,
        email: email || null,
        phone: phone || null,
        category: category || null,
      });
      if (result) setError(result);
      else setEditing(false);
    });
  };

  const handleCancel = () => {
    setName(contact.name);
    setTitle(contact.title ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setCategory(contact.category ?? "");
    setError(null);
    setEditing(false);
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteContact(contact.id);
      if (result) {
        setError(result);
        setConfirmingDelete(false);
      }
    });
  };

  if (editing) {
    return (
      <div className="space-y-3 py-3">
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
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">
            {contact.name}
            {contact.title ? <span className="text-muted-foreground"> · {contact.title}</span> : ""}
          </p>
          {(contact.email || contact.phone) && (
            <p className="text-xs text-muted-foreground">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              )}
              {contact.email && contact.phone ? " · " : ""}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                  {contact.phone}
                </a>
              )}
            </p>
          )}
        </div>
        {!confirmingDelete && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>
      {confirmingDelete && (
        <InlineConfirm
          message={`Delete ${contact.name}?`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onDismiss={() => setConfirmingDelete(false)}
          isPending={isPending}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
