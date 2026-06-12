"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAssessmentPayment } from "@/actions/treasury";
import type { AssessmentPayment, AssessmentStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssessmentEditPanelProps {
  payment: AssessmentPayment;
  onClose: () => void;
}

/**
 * Inline edit panel for a single assessment payment row.
 * Renders as an expanded section below the property row.
 * Calls updateAssessmentPayment on save and invokes onClose on success.
 */
export function AssessmentEditPanel({ payment, onClose }: AssessmentEditPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<AssessmentStatus>(payment.status);
  const [amountPaid, setAmountPaid] = useState((payment.amount_paid / 100).toFixed(2));
  const [paymentReference, setPaymentReference] = useState(payment.payment_reference ?? "");
  const [paidAt, setPaidAt] = useState(payment.paid_at ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    const cents = Math.round(parseFloat(amountPaid.replace(/[$,]/g, "")) * 100);
    startTransition(async () => {
      try {
        await updateAssessmentPayment(
          payment.id,
          status,
          isNaN(cents) ? 0 : cents,
          paymentReference || null,
          paidAt || null,
          notes || null
        );
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <div className="bg-muted/30 border-t px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as AssessmentStatus)}>
            <SelectTrigger className="h-8 text-sm" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label htmlFor="ap-amount" className="text-xs font-medium text-muted-foreground">Amount Paid ($)</label>
          <Input
            id="ap-amount"
            className="h-8 text-sm"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="ap-reference" className="text-xs font-medium text-muted-foreground">Payment Reference</label>
          <Input
            id="ap-reference"
            className="h-8 text-sm"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Check #, etc."
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="ap-paid-at" className="text-xs font-medium text-muted-foreground">Date Paid</label>
          <Input
            id="ap-paid-at"
            type="date"
            className="h-8 text-sm"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="ap-notes" className="text-xs font-medium text-muted-foreground">Notes</label>
        <Input
          id="ap-notes"
          className="text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Amount due: ${(payment.amount_due / 100).toLocaleString()}
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
