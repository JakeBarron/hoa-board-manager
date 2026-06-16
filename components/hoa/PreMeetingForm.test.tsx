import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreMeetingForm } from "./PreMeetingForm";

jest.mock("@/actions/pre-meeting", () => ({
  submitPreMeetingUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { submitPreMeetingUpdate } = jest.requireMock("@/actions/pre-meeting");

const defaultProps = {
  positionId: "pos-1",
  meetingId: "meeting-1",
  existingContent: undefined,
};

describe("PreMeetingForm", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("no meeting scheduled", () => {
    it("shows the empty state and no textarea when meetingId is null", () => {
      render(<PreMeetingForm positionId="pos-1" meetingId={null} />);
      expect(screen.getByText(/No meeting is scheduled yet/i)).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows a schedule link when canSchedule is true", () => {
      render(<PreMeetingForm positionId="pos-1" meetingId={null} canSchedule />);
      expect(screen.getByRole("link", { name: /Schedule a meeting/i })).toHaveAttribute("href", "/meetings");
    });

    it("hides the schedule link when canSchedule is false", () => {
      render(<PreMeetingForm positionId="pos-1" meetingId={null} />);
      expect(screen.queryByRole("link", { name: /Schedule a meeting/i })).not.toBeInTheDocument();
    });
  });

  describe("empty state (no existing content)", () => {
    it("shows the textarea and submit button", () => {
      render(<PreMeetingForm {...defaultProps} />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Submit update" })).toBeInTheDocument();
    });

    it("shows a validation error when submitted with empty content", async () => {
      render(<PreMeetingForm {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: "Submit update" }));
      await waitFor(() => {
        expect(
          screen.getByText("Please enter your update before submitting.")
        ).toBeInTheDocument();
      });
    });

    it("calls submitPreMeetingUpdate with positionId, meetingId, and content", async () => {
      render(<PreMeetingForm {...defaultProps} />);
      await userEvent.type(screen.getByRole("textbox"), "Pool pump repaired.");
      fireEvent.click(screen.getByRole("button", { name: "Submit update" }));
      await waitFor(() => {
        expect(submitPreMeetingUpdate).toHaveBeenCalledWith(
          "pos-1",
          "meeting-1",
          "Pool pump repaired."
        );
      });
    });

    it("shows the success state after a successful submit", async () => {
      render(<PreMeetingForm {...defaultProps} />);
      await userEvent.type(screen.getByRole("textbox"), "Done.");
      fireEvent.click(screen.getByRole("button", { name: "Submit update" }));
      await waitFor(() => {
        expect(screen.getByText("Done.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      });
    });
  });

  describe("existing content (already submitted)", () => {
    const props = { ...defaultProps, existingContent: "Last month summary." };

    it("starts in the success state when existingContent is provided", () => {
      render(<PreMeetingForm {...props} />);
      expect(screen.getByText("Last month summary.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("switches to the edit form when 'Edit' is clicked", async () => {
      render(<PreMeetingForm {...props} />);
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    });
  });
});
