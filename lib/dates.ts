/**
 * Returns ISO date strings (YYYY-MM-DD) for the next `count` Mondays.
 * If today is Monday, today is included as the first result.
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
