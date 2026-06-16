import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarAdmin } from "./CalendarAdmin";
import type {
  ResponsibilityArea,
  CalendarEvent,
  EventOccurrence,
} from "@/types/database";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/actions/calendar", () => ({
  saveArea: jest.fn(),
  deleteArea: jest.fn(),
  saveEvent: jest.fn(),
  deleteEvent: jest.fn(),
}));

const areas: ResponsibilityArea[] = [
  { id: "club", name: "Clubhouse", color: "#b45309", sort_order: 1, created_at: "2026-01-01T00:00:00Z" },
  { id: "home", name: "Homeside", color: "#0f766e", sort_order: 2, created_at: "2026-01-01T00:00:00Z" },
];

const baseEvent = {
  responsible_party: null,
  notes: null,
  template_url: null,
  created_by_position_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_by_position_id: null,
  updated_at: "2026-01-01T00:00:00Z",
};

const events: CalendarEvent[] = [
  { id: "e1", area_id: "club", title: "Monthly cleaning", ...baseEvent },
  { id: "e2", area_id: "home", title: "Legal retainer", ...baseEvent },
];

const occurrences: EventOccurrence[] = [
  { id: "o1", event_id: "e1", month: 1, day_of_month: null },
  { id: "o2", event_id: "e2", month: 1, day_of_month: null },
];

describe("CalendarAdmin", () => {
  it("groups events under their responsibility area sections", () => {
    render(<CalendarAdmin areas={areas} events={events} occurrences={occurrences} />);

    const clubhouse = screen.getByRole("region", { name: "Clubhouse" });
    expect(within(clubhouse).getByText("Monthly cleaning")).toBeInTheDocument();

    const homeside = screen.getByRole("region", { name: "Homeside" });
    expect(within(homeside).getByText("Legal retainer")).toBeInTheDocument();
    expect(within(homeside).queryByText("Monthly cleaning")).not.toBeInTheDocument();
  });

  it("opens an add-event form preselected to the section's area", async () => {
    render(<CalendarAdmin areas={areas} events={events} occurrences={occurrences} />);

    const clubhouse = screen.getByRole("region", { name: "Clubhouse" });
    await userEvent.click(
      within(clubhouse).getByRole("button", { name: /add event/i })
    );

    expect(within(clubhouse).getByLabelText("Title")).toBeInTheDocument();
    expect(within(clubhouse).getByLabelText("Area")).toHaveValue("club");
  });

  it("fills all twelve months when 'Every month' is clicked", async () => {
    render(<CalendarAdmin areas={areas} events={events} occurrences={occurrences} />);

    const clubhouse = screen.getByRole("region", { name: "Clubhouse" });
    await userEvent.click(
      within(clubhouse).getByRole("button", { name: /add event/i })
    );
    await userEvent.click(
      within(clubhouse).getByRole("button", { name: /every month/i })
    );

    expect(within(clubhouse).getAllByLabelText("Month")).toHaveLength(12);
  });

  it("collapses a section to hide its events", async () => {
    render(<CalendarAdmin areas={areas} events={events} occurrences={occurrences} />);

    const clubhouse = screen.getByRole("region", { name: "Clubhouse" });
    expect(within(clubhouse).getByText("Monthly cleaning")).toBeInTheDocument();

    await userEvent.click(
      within(clubhouse).getByRole("button", { name: /collapse clubhouse/i })
    );
    expect(within(clubhouse).queryByText("Monthly cleaning")).not.toBeInTheDocument();
  });
});
