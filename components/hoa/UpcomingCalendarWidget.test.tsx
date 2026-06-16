import { render, screen } from "@testing-library/react";
import { UpcomingCalendarWidget } from "./UpcomingCalendarWidget";
import type { CalendarItem } from "@/lib/calendar/calendar";

const items: CalendarItem[] = [
  {
    occurrenceId: "1",
    eventId: "e1",
    title: "Pool opens",
    month: 5,
    dayOfMonth: null,
    areaId: "pool",
    areaName: "Pool",
    areaColor: "#0891b2",
    responsibleParty: null,
    notes: null,
    templateUrl: null,
  },
];

describe("UpcomingCalendarWidget", () => {
  it("renders each item's title and area", () => {
    render(<UpcomingCalendarWidget items={items} />);
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<UpcomingCalendarWidget items={[]} />);
    expect(screen.getByText(/no upcoming/i)).toBeInTheDocument();
  });
});
