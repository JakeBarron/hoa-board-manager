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

const inProgressMeeting = {
  id: "meeting-3",
  meeting_date: "2026-07-08",
  status: "in_progress" as const,
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

  describe("Start Meeting button", () => {
    it("shows Start Meeting button when canRun is true and meeting is pending", () => {
      render(
        <MeetingRow
          meeting={pendingMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={jest.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /start meeting/i })).toBeInTheDocument();
    });

    it("does not show Start Meeting button when canRun is false", () => {
      render(
        <MeetingRow
          meeting={pendingMeeting}
          canSchedule={false}
          canRun={false}
          onStartMeeting={jest.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /start meeting/i })).not.toBeInTheDocument();
    });

    it("does not show Start Meeting button for adjourned meetings", () => {
      render(
        <MeetingRow
          meeting={adjournedMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={jest.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /start meeting/i })).not.toBeInTheDocument();
    });

    it("calls onStartMeeting with meeting id and 'pending' when clicked", async () => {
      const onStartMeeting = jest.fn();
      render(
        <MeetingRow
          meeting={pendingMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={onStartMeeting}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: /start meeting/i }));
      expect(onStartMeeting).toHaveBeenCalledWith("meeting-1", "pending");
    });

    it("shows a Resume Meeting button for in-progress meetings", () => {
      render(
        <MeetingRow
          meeting={inProgressMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={jest.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /resume meeting/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /start meeting/i })).not.toBeInTheDocument();
    });

    it("calls onStartMeeting with 'in_progress' when Resume is clicked", async () => {
      const onStartMeeting = jest.fn();
      render(
        <MeetingRow
          meeting={inProgressMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={onStartMeeting}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: /resume meeting/i }));
      expect(onStartMeeting).toHaveBeenCalledWith("meeting-3", "in_progress");
    });

    it("displays startError below the row", () => {
      render(
        <MeetingRow
          meeting={pendingMeeting}
          canSchedule={false}
          canRun={true}
          onStartMeeting={jest.fn()}
          startError="A meeting is already in progress — adjourn it before starting a new one."
        />
      );
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent("A meeting is already in progress");
    });
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
