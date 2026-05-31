import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleMeetingModal } from "./ScheduleMeetingModal";

jest.mock("@/actions/meetings", () => ({
  createMeeting: jest.fn().mockResolvedValue({ id: "new-meeting" }),
}));

const baseProps = {
  positionId: "pos-1",
  defaultDate: "2026-08-12",
  onClose: jest.fn(),
};

describe("ScheduleMeetingModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders with the date input pre-filled to defaultDate", () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    expect(screen.getByDisplayValue("2026-08-12")).toBeInTheDocument();
  });

  it("renders Schedule and Cancel buttons", () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("disables Schedule button when date input is empty", () => {
    render(<ScheduleMeetingModal {...baseProps} defaultDate="" />);
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();
  });

  it("calls createMeeting with positionId and selected date on submit", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(createMeeting).toHaveBeenCalledWith("pos-1", "2026-08-12");
  });

  it("calls onClose after successful submit", async () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("shows an error alert when createMeeting throws", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    createMeeting.mockRejectedValueOnce(new Error("A meeting is already scheduled for that date"));
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A meeting is already scheduled for that date");
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    render(<ScheduleMeetingModal {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("updates the date when user changes the input and calls createMeeting with new date", async () => {
    const { createMeeting } = jest.requireMock("@/actions/meetings");
    const { container } = render(<ScheduleMeetingModal {...baseProps} />);
    const input = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-09-09" } });
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(createMeeting).toHaveBeenCalledWith("pos-1", "2026-09-09");
  });
});
