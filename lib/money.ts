/**
 * Parses a user-entered dollar string into integer cents.
 * Strips leading "$" and thousands separators. Returns null when the input
 * is empty or not a number, so callers can distinguish "unset" from 0.
 *
 * @param input - Dollar string such as "1,250.00" or "$100"
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Formats integer cents as a whole-dollar USD string, e.g. 22549700 → "$225,497".
 *
 * @param cents - Amount in integer cents
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
