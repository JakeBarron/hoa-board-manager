import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingRow } from "./MeetingRow";
import { cancelMeeting, rescheduleMeeting } from "@/actions/meetings";

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
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("confirming cancel calls cancelMeeting with the meeting id", async () => {
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, cancel/i }));
    expect(cancelMeeting).toHaveBeenCalledWith("meeting-1");
  });

  it("saving a reschedule date calls rescheduleMeeting with the meeting id and date", async () => {
    const { container } = render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    const input = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-08-01" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(rescheduleMeeting).toHaveBeenCalledWith("meeting-1", "2026-08-01");
  });

  it("shows an error alert when cancelMeeting throws", async () => {
    const { cancelMeeting: mockCancel } = jest.requireMock("@/actions/meetings");
    mockCancel.mockRejectedValueOnce(new Error("Meeting is not in a cancellable state"));
    render(<MeetingRow meeting={pendingMeeting} canSchedule={true} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, cancel/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Meeting is not in a cancellable state");
  });
});
