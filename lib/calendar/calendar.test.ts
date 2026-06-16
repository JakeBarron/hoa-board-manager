// lib/calendar/calendar.test.ts
import {
  lastDayOfMonth,
  effectiveDate,
  buildCalendarItems,
  groupByMonth,
  upcomingItems,
  monthName,
  formatItemDate,
  type CalendarItem,
} from "./calendar";
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

const area: ResponsibilityArea = {
  id: "a1", name: "Pool", color: "#0891b2", sort_order: 9,
  created_at: "2026-01-01T00:00:00Z",
};
const event: CalendarEvent = {
  id: "e1", area_id: "a1", title: "Pool opens", responsible_party: "Pool Chair",
  notes: null, template_url: null, created_by_position_id: null,
  created_at: "2026-01-01T00:00:00Z", updated_by_position_id: null,
  updated_at: "2026-01-01T00:00:00Z",
};
const occ = (over: Partial<EventOccurrence>): EventOccurrence => ({
  id: "o1", event_id: "e1", month: 5, day_of_month: null, ...over,
});
const item = (over: Partial<CalendarItem>): CalendarItem => ({
  occurrenceId: "o1", eventId: "e1", title: "Pool opens", month: 5,
  dayOfMonth: null, areaId: "a1", areaName: "Pool", areaColor: "#0891b2",
  responsibleParty: "Pool Chair", notes: null, templateUrl: null, ...over,
});

describe("lastDayOfMonth", () => {
  it("returns 31 for March", () => expect(lastDayOfMonth(2026, 3)).toBe(31));
  it("returns 28 for a non-leap February", () => expect(lastDayOfMonth(2026, 2)).toBe(28));
  it("returns 29 for a leap February", () => expect(lastDayOfMonth(2028, 2)).toBe(29));
});

describe("effectiveDate", () => {
  it("uses day_of_month when set", () => {
    const d = effectiveDate({ month: 3, dayOfMonth: 1 }, 2026);
    expect(d.getMonth()).toBe(2); // March (0-based)
    expect(d.getDate()).toBe(1);
  });
  it("falls back to the last day of the month when day is null", () => {
    const d = effectiveDate({ month: 2, dayOfMonth: null }, 2026);
    expect(d.getDate()).toBe(28);
  });
});

describe("buildCalendarItems", () => {
  it("flattens an occurrence with its event and area", () => {
    const items = buildCalendarItems([area], [event], [occ({})]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Pool opens", month: 5, areaName: "Pool", areaColor: "#0891b2",
    });
  });
  it("drops occurrences whose event or area is missing", () => {
    expect(buildCalendarItems([], [event], [occ({})])).toHaveLength(0);
    expect(buildCalendarItems([area], [], [occ({})])).toHaveLength(0);
  });
});

describe("groupByMonth", () => {
  it("returns only months that have items, in Jan→Dec order", () => {
    const groups = groupByMonth([item({ month: 5 }), item({ month: 1 })]);
    expect(groups.map((g) => g.month)).toEqual([1, 5]);
  });
  it("sorts items within a month by day, month-end (null) last", () => {
    const groups = groupByMonth([
      item({ month: 3, dayOfMonth: null, title: "end" }),
      item({ month: 3, dayOfMonth: 1, title: "first" }),
    ]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["first", "end"]);
  });
});

describe("upcomingItems", () => {
  const today = new Date(2026, 10, 15); // Nov 15, 2026

  it("orders by next effective date from today", () => {
    const result = upcomingItems(
      [item({ month: 12, title: "Dec" }), item({ month: 11, dayOfMonth: 20, title: "Nov20" })],
      today
    );
    expect(result.map((i) => i.title)).toEqual(["Nov20", "Dec"]);
  });

  it("wraps items already past this year into next year (after later-this-year items)", () => {
    const result = upcomingItems(
      [item({ month: 1, title: "Jan (next yr)" }), item({ month: 12, title: "Dec (this yr)" })],
      today
    );
    expect(result.map((i) => i.title)).toEqual(["Dec (this yr)", "Jan (next yr)"]);
  });
});

describe("monthName / formatItemDate", () => {
  it("names months", () => expect(monthName(3)).toBe("March"));
  it("prefixes month-end deadlines with 'by'", () => {
    expect(formatItemDate(item({ month: 3, dayOfMonth: null }), 2026)).toMatch(/^by Mar/);
  });
  it("shows the exact day when set", () => {
    expect(formatItemDate(item({ month: 3, dayOfMonth: 1 }), 2026)).toBe("Mar 1");
  });
});
