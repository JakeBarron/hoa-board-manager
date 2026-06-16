// lib/calendar/calendar.ts
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

/**
 * A single event occurrence flattened with its parent event and responsibility
 * area, ready to render and sort. Built once per page from the three calendar
 * tables; all downstream helpers operate on this flat shape.
 */
export type CalendarItem = {
  occurrenceId: string;
  eventId: string;
  title: string;
  month: number; // 1–12
  dayOfMonth: number | null;
  areaId: string;
  areaName: string;
  areaColor: string; // hex
  responsibleParty: string | null;
  notes: string | null;
  templateUrl: string | null;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Returns the last calendar day (28–31) of a 1-based month in a given year.
 * Uses JS Date's day-0 rollover: day 0 of month N is the last day of month N-1.
 *
 * @param year  - Full year (e.g. 2026)
 * @param month - 1-based month (1 = January)
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Effective date of an occurrence in a given year: its `dayOfMonth` if set,
 * otherwise the last day of that month (a "by month-end" deadline).
 *
 * @param occ  - The occurrence's month (1-based) and optional day
 * @param year - The calendar year to resolve against
 */
export function effectiveDate(
  occ: { month: number; dayOfMonth: number | null },
  year: number
): Date {
  const day = occ.dayOfMonth ?? lastDayOfMonth(year, occ.month);
  return new Date(year, occ.month - 1, day);
}

/**
 * Flattens the three calendar tables into render-ready `CalendarItem`s.
 * Occurrences whose event or area cannot be resolved are dropped (defensive
 * against partial data). One item per occurrence.
 *
 * @param areas       - All responsibility areas
 * @param events      - All calendar events
 * @param occurrences - All event occurrences
 */
export function buildCalendarItems(
  areas: ResponsibilityArea[],
  events: CalendarEvent[],
  occurrences: EventOccurrence[]
): CalendarItem[] {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  return occurrences.flatMap((o) => {
    const event = eventById.get(o.event_id);
    if (!event) return [];
    const area = areaById.get(event.area_id);
    if (!area) return [];
    return [
      {
        occurrenceId: o.id,
        eventId: event.id,
        title: event.title,
        month: o.month,
        dayOfMonth: o.day_of_month,
        areaId: area.id,
        areaName: area.name,
        areaColor: area.color,
        responsibleParty: event.responsible_party,
        notes: event.notes,
        templateUrl: event.template_url,
      },
    ];
  });
}

/**
 * Groups items by calendar month in Jan→Dec order. Only months that contain at
 * least one item are returned. Items within a month are sorted by day, with
 * month-end (null day) deadlines sorted last.
 *
 * @param items - Flat calendar items (already area-filtered if desired)
 */
export function groupByMonth(
  items: CalendarItem[]
): { month: number; items: CalendarItem[] }[] {
  const byMonth = new Map<number, CalendarItem[]>();
  for (const it of items) {
    const list = byMonth.get(it.month) ?? [];
    list.push(it);
    byMonth.set(it.month, list);
  }
  return Array.from(byMonth.keys())
    .sort((a, b) => a - b)
    .map((month) => ({
      month,
      items: byMonth
        .get(month)!
        .slice()
        .sort((a, b) => (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99)),
    }));
}

/**
 * Returns items ordered by their next effective date from `today`, wrapping
 * past year-end. An item whose effective date this year has already passed is
 * treated as next year's, so the list never empties late in the year.
 *
 * @param items - Flat calendar items
 * @param today - Reference date (default now; pass a fixed date in tests)
 */
export function upcomingItems(
  items: CalendarItem[],
  today: Date = new Date()
): CalendarItem[] {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const year = startOfToday.getFullYear();
  return items
    .map((it) => {
      let when = effectiveDate(it, year);
      if (when < startOfToday) when = effectiveDate(it, year + 1);
      return { it, when };
    })
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .map((x) => x.it);
}

/**
 * Full English name of a 1-based month (1 → "January").
 *
 * @param month - 1-based month
 */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

/**
 * Formats an item's effective date as a short label. Month-end deadlines
 * (null day) are prefixed with "by" (e.g. "by Mar 31"); fixed days show the
 * exact date (e.g. "Mar 1").
 *
 * @param item - The calendar item
 * @param year - Year to resolve the date against (default current year)
 */
export function formatItemDate(
  item: CalendarItem,
  year: number = new Date().getFullYear()
): string {
  const d = effectiveDate(item, year);
  const formatted = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return item.dayOfMonth == null ? `by ${formatted}` : formatted;
}
