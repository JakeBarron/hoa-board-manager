/**
 * One-time prod import: reads the membership report CSV and upserts all valid
 * rows into the `properties` table via the service role key.
 *
 * Usage:
 *   npx tsx --env-file=.env.prod supabase/import-properties-prod.ts <path-to-csv>
 *
 * - Skips OON rows (non-integer lot numbers) and prints a warning for each.
 * - Safe to re-run — uses upsert on lot_number.
 *
 * WARNING: Always use .env.prod with this script, never .env.local.
 * The script prints the target Supabase URL at startup so you can verify.
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error(
    "Usage: npx tsx --env-file=.env.prod supabase/import-properties-prod.ts <path-to-csv>"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Column indices (0-based) in the membership report CSV
const COL = {
  LOT_NUMBER: 0,
  FIRST_NAME: 1,
  LAST_NAME: 2,
  ACCOUNT_NUMBER: 3,
  STREET_ADDRESS: 4,
  MEMBERSHIP: 5,
  MEMBERSHIP_TYPE: 6,
  // 7–13: financial columns — skipped
  ANNUAL_LEASE_FEE: 14,
  // 15: Billing Comments — skipped
  // 16: Other Comments — skipped
  EMAIL_1: 17,
  EMAIL_2: 18,
  // 19: Email 3 — skipped (not in DB schema)
  // 20: Household Name — skipped
  // 21: Street Address (duplicate) — skipped
  KEY_FOB_1: 22,
  KEY_FOB_2: 23,
  SAYOR: 24,
} as const;

/**
 * Normalizes membership to remove spurious whitespace after the hyphen.
 * e.g. "Non- Covenant" → "Non-Covenant", "Non- ESL Resident" → "Non-ESL Resident"
 */
function normalizeMembership(raw: string): string {
  return raw.trim().replace(/Non-\s+/, "Non-");
}

/**
 * Extracts the membership_type suffix — the portion after " - ".
 * Returns null when there is no " - " (e.g. plain "Non-Covenant").
 */
function extractMembershipType(membershipTypeRaw: string): string | null {
  const idx = membershipTypeRaw.indexOf(" - ");
  if (idx === -1) return null;
  const suffix = membershipTypeRaw.slice(idx + 3).trim();
  return suffix || null;
}

/**
 * Parses annual_lease_fee: strips "$" and "," then converts to float.
 * Returns null for empty strings or non-numeric values like "Yes".
 */
function parseAnnualLeaseFee(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Returns true when the cell indicates an annual lease fee applies —
 * either an explicit "Yes" or a non-zero dollar amount.
 */
function parseHasAnnualLeaseFee(raw: string): boolean {
  if (raw.trim().toLowerCase() === "yes") return true;
  const n = parseAnnualLeaseFee(raw);
  return n !== null && n > 0;
}

/**
 * Parses SAYOR: any value starting with "Y" (case-insensitive) is true.
 * Handles extended notes like "Y as of 5/25 — ACH in system" → true.
 */
function parseSayor(raw: string): boolean {
  return raw.trim().toUpperCase().startsWith("Y");
}

/**
 * Parses lot_number: must be a valid integer.
 * Returns null for non-integer values like "OON 1".
 */
function parseLotNumber(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

/** Returns null for empty/whitespace-only strings, otherwise trims. */
function nullIfEmpty(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

async function main() {
  console.log(`Target: ${supabaseUrl}\n`);

  const fileContent = fs.readFileSync(path.resolve(csvPath), "utf-8");

  // csv-parse handles quoted multiline fields, escaped quotes, and trailing commas
  const records = parse(fileContent, {
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as string[][];

  // First row is headers
  const rows = records.slice(1);

  const properties: Array<Record<string, unknown>> = [];
  const skipped: Array<{ lot: string; name: string }> = [];

  for (const row of rows) {
    const lotNumber = parseLotNumber(row[COL.LOT_NUMBER] ?? "");

    if (lotNumber === null) {
      skipped.push({
        lot: row[COL.LOT_NUMBER] ?? "",
        name: `${row[COL.FIRST_NAME] ?? ""} ${row[COL.LAST_NAME] ?? ""}`.trim(),
      });
      continue;
    }

    properties.push({
      lot_number: lotNumber,
      first_name: nullIfEmpty(row[COL.FIRST_NAME]),
      last_name: (row[COL.LAST_NAME] ?? "").trim(),
      account_number: nullIfEmpty(row[COL.ACCOUNT_NUMBER]),
      street_address: nullIfEmpty(row[COL.STREET_ADDRESS]),
      membership: nullIfEmpty(normalizeMembership(row[COL.MEMBERSHIP] ?? "")),
      membership_type: extractMembershipType(row[COL.MEMBERSHIP_TYPE] ?? ""),
      annual_lease_fee: parseAnnualLeaseFee(row[COL.ANNUAL_LEASE_FEE] ?? ""),
      has_annual_lease_fee: parseHasAnnualLeaseFee(row[COL.ANNUAL_LEASE_FEE] ?? ""),
      email_1: nullIfEmpty(row[COL.EMAIL_1]),
      email_2: nullIfEmpty(row[COL.EMAIL_2]),
      key_fob_1: nullIfEmpty(row[COL.KEY_FOB_1]),
      key_fob_2: nullIfEmpty(row[COL.KEY_FOB_2]),
      sayor: parseSayor(row[COL.SAYOR] ?? ""),
    });
  }

  if (skipped.length > 0) {
    console.warn(`Skipping ${skipped.length} row(s) with non-integer lot numbers:`);
    for (const s of skipped) {
      console.warn(`  "${s.lot}" — ${s.name}`);
    }
    console.warn();
  }

  console.log(`Upserting ${properties.length} property rows…`);

  const { error } = await supabase
    .from("properties")
    .upsert(properties, { onConflict: "lot_number" });

  if (error) throw new Error(`Upsert failed: ${error.message}`);

  console.log(`✓ Done. ${properties.length} rows upserted.`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
