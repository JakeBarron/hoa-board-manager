"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuote, deleteQuote, selectQuote, updateCRAProject } from "@/actions/cra";
import { parseDollarsToCents, formatCents } from "@/lib/money";
import { quoteReadiness } from "@/lib/cra/projects";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Button } from "@/components/ui/button";
import type { CRAQuote } from "@/types/database";

interface CRAQuotesSectionProps {
  projectId: string;
  quotes: CRAQuote[];
  canEdit: boolean;
}

const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Quotes list + add form for a CRA project. Shows 3-quote readiness, the
 * selected vendor, and (for editors) add/delete/select controls. Selecting a
 * quote offers to set the project's actual cost to that quote's amount.
 *
 * @param projectId - Owning project UUID
 * @param quotes    - Quotes attached to the project
 * @param canEdit   - Whether the current user may edit
 */
export function CRAQuotesSection({ projectId, quotes, canEdit }: CRAQuotesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const readiness = quoteReadiness(quotes.length);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = parseDollarsToCents(amount);
    if (!vendor.trim()) { setError("Vendor name is required."); return; }
    if (cents === null) { setError("Enter a valid amount."); return; }
    startTransition(async () => {
      await addQuote({
        projectId, vendorName: vendor, amount: cents,
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        notes: notes.trim() || null,
      });
      setVendor(""); setAmount(""); setContactName(""); setContactPhone("");
      setContactEmail(""); setNotes(""); setAdding(false);
      router.refresh();
    });
  };

  const choose = (quote: CRAQuote) =>
    startTransition(async () => {
      await selectQuote(projectId, quote.id);
      await updateCRAProject(projectId, { actual_cost: quote.amount });
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteQuote(id);
      setDeleteId(null);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <p className={readiness.met ? "text-sm text-green-600" : "text-sm text-amber-600"}>
        {readiness.count} of {readiness.required} quotes
      </p>

      <ul className="space-y-3">
        {quotes.map((q) => (
          <li key={q.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {q.vendor_name} · {formatCents(q.amount)}
                  {q.is_selected && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">Selected</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {[q.contact_name, q.contact_phone, q.contact_email].filter(Boolean).join(" · ")}
                </p>
                {q.notes && <p className="mt-1">{q.notes}</p>}
                {q.document_url && (
                  <a href={q.document_url} className="text-primary underline" target="_blank" rel="noreferrer">
                    Quote document
                  </a>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  {!q.is_selected && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => choose(q)}>Select</Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setDeleteId(q.id)}>Delete</Button>
                </div>
              )}
            </div>
            {deleteId === q.id && (
              <div className="mt-2">
                <InlineConfirm message="Delete this quote?" confirmLabel="Delete"
                  onConfirm={() => remove(q.id)} onDismiss={() => setDeleteId(null)} isPending={isPending} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add quote</Button>
      )}

      {canEdit && adding && (
        <form onSubmit={submitAdd} className="space-y-2 rounded-md border border-border p-3">
          <input className={input} placeholder="Vendor name" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={isPending} />
          <input className={input} inputMode="decimal" placeholder="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={isPending} />
          <input className={input} placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={isPending} />
          <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save quote"}</Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
