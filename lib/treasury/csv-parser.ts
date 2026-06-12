import Papa from "papaparse";
import type { AccountType } from "@/types/database";

export interface ParsedBudgetRow {
  gl_code: string;
  description: string;
  category: string;
  account_type: AccountType;
  budget_amount: number;
  monthly_amounts: { month_start: string; amount: number }[];
}

export interface CSVParseResult {
  rows: ParsedBudgetRow[];
  errors: string[];
  skippedCount: number;
}

const GL_CODE_RE = /^\d{2}-\d{4}-\d{2}$/;
const FISCAL_MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

/**
 * Parses a Homeside GL CSV export into structured budget line items.
 * Converts dollar amounts to integer cents. Section headers update
 * context (Operating/Reserve, Income/Expense, Category). GL rows
 * become ParsedBudgetRow entries. Errors are non-fatal; check the
 * errors array before persisting.
 *
 * @param csvText         - Raw CSV string from file upload
 * @param fiscalYearStart - ISO date of the fiscal year's April 1 (e.g. "2025-04-01")
 */
export function parseBudgetCSV(csvText: string, fiscalYearStart: string): CSVParseResult {
  const rows: ParsedBudgetRow[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  const { data: records } = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const headerIdx = findHeaderRowIndex(records);
  if (headerIdx === -1) {
    const firstRow = records[0]?.slice(0, 6).join(", ") ?? "(empty file)";
    return {
      rows: [],
      errors: [
        `Could not find header row containing month column names (Apr–Mar). ` +
        `The parser looks for columns starting with Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar. ` +
        `First row found: "${firstRow}${records[0]?.length > 6 ? "…" : ""}"`,
      ],
      skippedCount: records.length,
    };
  }

  const header = records[headerIdx].map((h) => h.toLowerCase().trim());
  const glCol = findColumnIndex(header, ["gl code", "gl #", "account number", "account #"]) ?? 0;
  const descCol = findColumnIndex(header, ["account description", "description", "name"]) ?? 1;
  const budgetCol = findBudgetColumn(header);
  const monthCols = FISCAL_MONTHS.map((m) => header.findIndex((h) => h.startsWith(m)));
  const monthStarts = generateMonthStarts(fiscalYearStart);

  type AccountSection = "operating" | "reserve";
  type IncomeSection = "income" | "expense";

  let accountSection: AccountSection | null = null;
  let incomeSection: IncomeSection | null = null;
  let category: string | null = null;

  for (let i = headerIdx + 1; i < records.length; i++) {
    const record = records[i];
    const glCell = (record[glCol] ?? "").trim();
    const descCell = (record[descCol] ?? "").trim();
    const text = (descCell || glCell || record[0] || "").toLowerCase().trim();

    if (!glCell && !descCell && !record[0]?.trim()) continue;

    if (GL_CODE_RE.test(glCell)) {
      if (!accountSection || !incomeSection || !category) {
        errors.push(`Row ${i + 1}: GL code "${glCell}" found before section context was established — skipped.`);
        continue;
      }

      const account_type: AccountType = `${accountSection}_${incomeSection}` as AccountType;
      const budgetStr = (record[budgetCol] ?? "").replace(/[$,\s]/g, "");
      const budget_amount = parseCents(budgetStr);

      const monthly_amounts = FISCAL_MONTHS.map((_, idx) => {
        const colIdx = monthCols[idx];
        const raw = colIdx >= 0 && colIdx < record.length ? record[colIdx] : "";
        return {
          month_start: monthStarts[idx],
          amount: parseCents(raw.replace(/[$,\s]/g, "")),
        };
      });

      rows.push({ gl_code: glCell, description: descCell, category, account_type, budget_amount, monthly_amounts });
    } else {
      // Section context header
      if (text.includes("operating account")) {
        accountSection = "operating";
        incomeSection = null;
        category = null;
      } else if (text.includes("reserve account")) {
        accountSection = "reserve";
        incomeSection = null;
        category = null;
      } else if (text === "income accounts" || text === "income") {
        incomeSection = "income";
        category = null;
      } else if (text === "expense accounts" || text === "expense") {
        incomeSection = "expense";
        category = null;
      } else if (text && accountSection && incomeSection) {
        category = descCell || glCell || (record[0] ?? "").trim();
      } else {
        skippedCount++;
      }
    }
  }

  return { rows, errors, skippedCount };
}

/**
 * Scans records to find the header row by checking for at least 3 fiscal month column names.
 * Returns the row index or -1 if not found.
 */
function findHeaderRowIndex(records: string[][]): number {
  for (let i = 0; i < records.length; i++) {
    const row = records[i].map((c) => c.toLowerCase().trim());
    const hits = row.filter((c) => FISCAL_MONTHS.some((m) => c.startsWith(m))).length;
    if (hits >= 3) return i;
  }
  return -1;
}

/**
 * Returns the first index in header that matches any candidate string.
 * Returns null if no match is found.
 *
 * @param header     - Lowercased header cells
 * @param candidates - Candidate column names to search for
 */
function findColumnIndex(header: string[], candidates: string[]): number | null {
  for (const candidate of candidates) {
    const idx = header.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return null;
}

/**
 * Finds the budget column index by looking for a header cell containing a 4-digit year and "budget".
 * Falls back to column index 2 if not found.
 *
 * @param header - Lowercased header cells
 */
function findBudgetColumn(header: string[]): number {
  const idx = header.findIndex((h) => /\d{4}/.test(h) && h.includes("budget"));
  return idx >= 0 ? idx : 2;
}

/**
 * Converts a string dollar amount (stripped of $ and commas) to integer cents.
 * Returns 0 for empty, dash, or non-numeric values.
 *
 * @param value - Numeric string (e.g. "12183" from "$12,183")
 */
function parseCents(value: string): number {
  if (!value || value === "-" || value === "") return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/**
 * Generates 12 month_start ISO date strings beginning at fiscalYearStart (April 1).
 * Months wrap into the next calendar year after December.
 *
 * @param fiscalYearStart - ISO date string for the first month (e.g. "2025-04-01")
 */
function generateMonthStarts(fiscalYearStart: string): string[] {
  const starts: string[] = [];
  const base = new Date(fiscalYearStart + "T00:00:00Z");
  for (let i = 0; i < 12; i++) {
    const d = new Date(base);
    d.setUTCMonth(base.getUTCMonth() + i);
    starts.push(d.toISOString().slice(0, 10));
  }
  return starts;
}
