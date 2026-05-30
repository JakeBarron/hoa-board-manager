import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingRow } from "./MeetingRow";

jest.mock("@/actions/meetings", () => ({
  cancelMeeting: jest.fn().mockResolvedValue(undefined),
  rescheduleMeeting: jest.fn().mockResolvedValue(undefined),
}));

const pendingMeeting = {
  id: "meeting-1",
  meeting_date: "2026-07-08",
  status: "pending" as const,
};

const adjournedMeeting = {
  id: "meeting-2",
  meeting_date: "2026-06-03",
  status: "adjourned" as const,
};

describe("MeetingRow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not render action buttons when canSchedule is false", () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={false} />);
    expect(screen.queryByRole("button", { name: /reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("does not render action buttons when meeting status is not pending", () => {
    render(<MeetingRow meeting={adjournedMeeting} canSchedule={true} />);
    expect(screen.queryByRole("button", { name: /reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("renders Reschedule and Cancel buttons for pending meetings when canSchedule is true", () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("clicking Cancel shows the InlineConfirm strip", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText(/cancel the.*meeting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, cancel/i })).toBeInTheDocument();
  });

  it("clicking Dismiss in the confirm strip returns to default mode", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByText(/cancel the.*meeting/i)).not.toBeInTheDocument();
  });

  it("clicking Reschedule shows the InlineDateInput", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("clicking Cancel in the date input returns to default mode", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
