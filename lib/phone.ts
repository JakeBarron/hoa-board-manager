/**
 * Strips a phone string to its significant digits, normalizing a leading
 * US country code. Returns the 10 national digits, or null when the input
 * does not contain a valid 10-digit US number (optionally prefixed with "1").
 *
 * @param raw - Free-form phone input such as "(770) 555-1234" or "+1 770 555 1234"
 */
function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

/**
 * Formats a phone string as "(770) 555-1234". If the input is not a valid
 * 10-digit US number, it is returned unchanged so partial/foreign input is
 * never silently mangled.
 *
 * @param raw - Free-form phone input
 */
export function formatPhone(raw: string): string {
  const national = normalizeUsPhone(raw);
  if (national === null) return raw;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

/**
 * Returns true when the input is a valid 10-digit US phone number (optionally
 * with a leading "1" country code). Formatting characters are ignored.
 *
 * @param raw - Free-form phone input
 */
export function isValidPhone(raw: string): boolean {
  return normalizeUsPhone(raw) !== null;
}
