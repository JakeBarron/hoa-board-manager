import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarView } from "./CalendarView";
import type { CalendarItem } from "@/lib/calendar/calendar";

const items: CalendarItem[] = [
  { occurrenceId: "1", eventId: "e1", title: "Pool opens", month: 5, dayOfMonth: null,
    areaId: "pool", areaName: "Pool", areaColor: "#0891b2",
    responsibleParty: null, notes: null, templateUrl: null },
  { occurrenceId: "2", eventId: "e2", title: "Legal retainer due", month: 1, dayOfMonth: null,
    areaId: "homeside", areaName: "Homeside", areaColor: "#0f766e",
    responsibleParty: null, notes: null, templateUrl: null },
];

describe("CalendarView", () => {
  it("shows all events by default", () => {
    render(<CalendarView items={items} />);
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.getByText("Legal retainer due")).toBeInTheDocument();
  });

  it("filters to a single area when its toggle is clicked", async () => {
    render(<CalendarView items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /^Pool$/ }));
    expect(screen.getByText("Pool opens")).toBeInTheDocument();
    expect(screen.queryByText("Legal retainer due")).not.toBeInTheDocument();
  });
});
