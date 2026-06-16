/**
 * Returns ISO date strings (YYYY-MM-DD) for the next `count` Mondays.
 * If today is Monday, today is included as the first result.
 * Used as a fallback when no meeting cadence is configured.
 *
 * @param count - Number of Mondays to return (default 3)
 * @param from  - Reference date (default today; pass a fixed date in tests)
 */
export function getUpcomingMondays(count = 3, from = new Date()): string[] {
  const result: string[] = [];
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);

  const day = date.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  if (day !== 1) {
    const daysToMonday = day === 0 ? 1 : 8 - day;
    date.setDate(date.getDate() + daysToMonday);
  }

  for (let i = 0; i < count; i++) {
    result.push(date.toISOString().split("T")[0]);
    date.setDate(date.getDate() + 7);
  }
  return result;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) for human-readable display.
 * Example: "2026-05-28" → "May 28, 2026"
 *
 * @param isoDate - ISO date string in YYYY-MM-DD format
 */
export function formatMeetingDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Parses a meeting cadence string ("week:dayOfWeek") into its components.
 * week = 1-4 (ordinal) or 5 (last); dayOfWeek = 0 (Sun) … 6 (Sat).
 * Returns null if the string is malformed.
 *
 * @param value - Cadence string e.g. "3:2" for 3rd Tuesday
 */
export function parseCadence(
  value: string
): { week: number; dayOfWeek: number } | null {
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const week = parseInt(parts[0], 10);
  const dayOfWeek = parseInt(parts[1], 10);
  if (
    isNaN(week) ||
    isNaN(dayOfWeek) ||
    week < 1 ||
    week > 5 ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  )
    return null;
  return { week, dayOfWeek };
}

/**
 * Returns a human-readable description of a cadence value.
 * Example: "3:2" → "3rd Tuesday of each month"
 *
 * @param value - Cadence string e.g. "3:2"
 */
export function describeCadence(value: string): string {
  const cadence = parseCadence(value);
  if (!cadence) return value;
  const ordinals = ["1st", "2nd", "3rd", "4th", "Last"];
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `${ordinals[cadence.week - 1]} ${days[cadence.dayOfWeek]} of each month`;
}

/**
 * Returns the date of the nth weekday in a given month.
 * If week=5 ("last"), finds the last occurrence of that weekday.
 *
 * @param year      - Full year e.g. 2026
 * @param month     - 0-indexed month (0=Jan … 11=Dec)
 * @param week      - 1-4 for ordinal occurrence, 5 for last
 * @param dayOfWeek - 0=Sun … 6=Sat
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  week: number,
  dayOfWeek: number
): Date {
  const firstOfMonth = new Date(year, month, 1);
  const firstOccurrence =
    1 + ((dayOfWeek - firstOfMonth.getDay() + 7) % 7);

  let dayOfMonth: number;
  if (week === 5) {
    // Walk forward three more weeks, then step back if we've left the month
    const candidate = firstOccurrence + 21;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    dayOfMonth = candidate > daysInMonth ? candidate - 7 : candidate;
  } else {
    dayOfMonth = firstOccurrence + (week - 1) * 7;
  }

  const result = new Date(year, month, dayOfMonth);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Returns upcoming meeting dates derived from a cadence string.
 * Falls back to getUpcomingMondays() if the cadence is invalid.
 * If the next occurrence for the current month falls on or after `from`,
 * it is included as the first result.
 *
 * @param cadenceValue - Cadence string e.g. "3:2" for 3rd Tuesday
 * @param count        - Number of dates to return (default 3)
 * @param from         - Reference date (default today)
 */
export function getUpcomingMeetingDates(
  cadenceValue: string,
  count = 3,
  from = new Date()
): string[] {
  const cadence = parseCadence(cadenceValue);
  if (!cadence) return getUpcomingMondays(count, from);

  const { week, dayOfWeek } = cadence;
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);

  const results: string[] = [];
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth();

  while (results.length < count) {
    const date = getNthWeekdayOfMonth(year, month, week, dayOfWeek);
    if (date >= fromDate) {
      results.push(date.toISOString().split("T")[0]);
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return results;
}

/**
 * Picks the next meeting date strictly after both today and a reference date,
 * following the configured cadence. Used to auto-schedule the next meeting when
 * the queue empties on adjournment. Empty/invalid cadence falls back to the
 * default (3rd Tuesday) via getUpcomingMeetingDates.
 *
 * @param cadenceValue - Cadence string e.g. "3:2"; empty falls back to "3:2"
 * @param afterDate    - The just-adjourned meeting's date (YYYY-MM-DD)
 * @param todayValue   - Today's date (YYYY-MM-DD) in the app timezone
 * @param from         - Reference date for generating candidates (default today)
 * @returns The next cadence date strictly after the later of today/afterDate, or null
 */
export function pickNextMeetingDate(
  cadenceValue: string,
  afterDate: string,
  todayValue: string,
  from = new Date()
): string | null {
  const floor = afterDate > todayValue ? afterDate : todayValue;
  const candidates = getUpcomingMeetingDates(cadenceValue || "3:2", 4, from);
  return candidates.find((d) => d > floor) ?? null;
}
