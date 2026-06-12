"use client";

import { useState, useTransition } from "react";
import { parseBudgetCSV, type ParsedBudgetRow, type CSVParseResult } from "@/lib/treasury/csv-parser";
import { importBudget } from "@/actions/treasury";
import { Button } from "@/components/ui/button";
import { FileUploadButton } from "@/components/hoa/FileUploadButton";

interface CSVImportDialogProps {
  fiscalYearId: string;
  fiscalYearStart: string;
  /** Called after a successful import. Defaults to a no-op. */
  onSuccess?: () => void;
}

type Step = "idle" | "preview" | "importing" | "done";

/**
 * Three-step CSV import: (1) upload and parse, (2) preview parsed rows with
 * any warnings, (3) confirm and persist. Parse errors are shown before any
 * data is written to the database.
 *
 * @param fiscalYearId    - UUID of the fiscal year to import into
 * @param fiscalYearStart - ISO date of the fiscal year start (e.g. "2025-04-01")
 * @param onSuccess       - Called after a successful import
 */
export function CSVImportDialog({ fiscalYearId, fiscalYearStart, onSuccess = () => {} }: CSVImportDialogProps) {
  const [step, setStep] = useState<Step>("idle");
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseBudgetCSV(text, fiscalYearStart);
    setParseResult(result);
    setStep("preview");
  };

  const handleConfirm = () => {
    if (!parseResult) return;
    setImportError(null);
    startTransition(async () => {
      try {
        await importBudget(fiscalYearId, parseResult.rows);
        setStep("done");
        onSuccess();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  const handleReset = () => {
    setStep("idle");
    setParseResult(null);
    setImportError(null);
    setResetKey((k) => k + 1);
  };

  if (step === "idle") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload the Homeside GL CSV export. You will see a preview before anything is saved.
        </p>
        <FileUploadButton
          accept=".csv"
          label="Choose CSV File"
          onChange={handleFile}
          resetKey={resetKey}
        />
      </div>
    );
  }

  if (step === "preview" && parseResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{parseResult.rows.length} line items parsed</span>
          {parseResult.skippedCount > 0 && (
            <span className="text-xs text-muted-foreground">{parseResult.skippedCount} rows skipped</span>
          )}
        </div>

        {parseResult.errors.length > 0 && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            <p className="text-sm font-medium text-destructive">Parse warnings</p>
            {parseResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2 font-medium">GL Code</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-right p-2 font-medium">Budget</th>
              </tr>
            </thead>
            <tbody>
              {parseResult.rows.map((row: ParsedBudgetRow) => (
                <tr key={row.gl_code} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{row.gl_code}</td>
                  <td className="p-2">{row.description}</td>
                  <td className="p-2">{row.category}</td>
                  <td className="p-2">{row.account_type}</td>
                  <td className="p-2 text-right">${(row.budget_amount / 100).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {importError && <p className="text-sm text-destructive">{importError}</p>}

        <div className="flex gap-3">
          <Button onClick={handleConfirm} disabled={isPending || parseResult.rows.length === 0 || parseResult.errors.length > 0}>
            {isPending ? "Importing…" : `Import ${parseResult.rows.length} rows`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Choose Different File
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-600 font-medium">Import complete.</p>
        <Button variant="outline" onClick={handleReset}>Import Another File</Button>
      </div>
    );
  }

  return null;
}
