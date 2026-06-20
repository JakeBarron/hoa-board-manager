"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCRAProject } from "@/actions/cra";
import { parseDollarsToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/hoa/FormField";
import type { CRAPriority } from "@/types/database";

interface FiscalYearOption { id: string; label: string }

interface CRAProjectFormProps {
  fiscalYears: FiscalYearOption[];
  defaultFiscalYearId: string | null;
  existingCategories: string[];
  hoaName: string;
}

/**
 * Create-project form. Name + estimated cost (dollars) are required; the
 * estimate is converted to integer cents on submit. Category uses a datalist
 * of existing values. On success, navigates to the new project's detail page.
 *
 * @param fiscalYears         - Fiscal-year options (most-recent first)
 * @param defaultFiscalYearId - Pre-selected fiscal year, or null
 * @param existingCategories  - Distinct categories already in use (datalist)
 * @param hoaName             - HOA name for the reserve-study helper text
 */
export function CRAProjectForm({
  fiscalYears, defaultFiscalYearId, existingCategories, hoaName,
}: CRAProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<CRAPriority | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState(defaultFiscalYearId ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    const cents = parseDollarsToCents(estimate);
    if (cents === null) { setError("Enter a valid estimated cost."); return; }

    startTransition(async () => {
      try {
        const { id } = await createCRAProject({
          name,
          estimatedCost: cents,
          description: description.trim() || null,
          category: category.trim() || null,
          priority: priority || null,
          targetDate: targetDate || null,
          fiscalYearId: fiscalYearId || null,
        });
        router.push(`/cra?expand=${id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create project.");
      }
    });
  };

  const input = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <FormField htmlFor="cra-name" label="Name" required>
        <input id="cra-name" className={input} value={name}
          onChange={(e) => setName(e.target.value)} disabled={isPending} />
      </FormField>

      <FormField htmlFor="cra-estimate" label="Estimated cost (USD)" required>
        <input id="cra-estimate" className={input} inputMode="decimal" placeholder="100000"
          value={estimate} onChange={(e) => setEstimate(e.target.value)} disabled={isPending} />
        <p className="text-xs text-muted-foreground">
          Refer to the Updated Capital Reserve Analysis for {hoaName} for the initial estimate.
        </p>
      </FormField>

      <FormField htmlFor="cra-category" label="Category">
        <input id="cra-category" className={input} list="cra-categories"
          value={category} onChange={(e) => setCategory(e.target.value)} disabled={isPending} />
        <datalist id="cra-categories">
          {existingCategories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </FormField>

      <FormField htmlFor="cra-priority" label="Priority">
        <select id="cra-priority" className={input} value={priority} disabled={isPending}
          onChange={(e) => setPriority(e.target.value as CRAPriority | "")}>
          <option value="">None</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </FormField>

      <FormField htmlFor="cra-target" label="Target date">
        <input id="cra-target" type="date" className={input}
          value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={isPending} />
      </FormField>

      <FormField htmlFor="cra-fy" label="Fiscal year">
        <select id="cra-fy" className={input} value={fiscalYearId} disabled={isPending}
          onChange={(e) => setFiscalYearId(e.target.value)}>
          <option value="">Unassigned</option>
          {fiscalYears.map((fy) => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
        </select>
      </FormField>

      <FormField htmlFor="cra-desc" label="Description">
        <textarea id="cra-desc" className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
          value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} />
      </FormField>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
