import Link from "next/link";
import { formatItemDate, type CalendarItem } from "@/lib/calendar/calendar";
import { SectionCard } from "./SectionCard";
import { EmptyState } from "./EmptyState";

interface UpcomingCalendarWidgetProps {
  /** Pre-sorted upcoming items (already sliced to the desired count). */
  items: CalendarItem[];
}

/**
 * Dashboard card listing the next handful of upcoming calendar items.
 * Presentational only — the caller is responsible for sorting and slicing.
 *
 * `SectionCard.description` is typed `string`, so the "View full calendar"
 * link is rendered inside the card body rather than the description slot.
 *
 * @param items - Upcoming calendar items in display order
 */
export function UpcomingCalendarWidget({ items }: UpcomingCalendarWidgetProps) {
  return (
    <SectionCard
      title="Upcoming on the Calendar"
      description="The next few items on the operating calendar"
    >
      {items.length === 0 ? (
        <EmptyState title="No upcoming events" />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.occurrenceId} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: it.areaColor }}
              />
              <span className="flex-1">
                <span className="font-medium">{it.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{it.areaName}</span>
              </span>
              <span className="text-xs text-muted-foreground">{formatItemDate(it)}</span>
            </li>
          ))}
          <li className="pt-1">
            <Link href="/calendar" className="text-xs text-primary hover:underline">
              View full calendar
            </Link>
          </li>
        </ul>
      )}
    </SectionCard>
  );
}
