import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreMeetingForm } from "./PreMeetingForm";

jest.mock("@/actions/pre-meeting", () => ({
  submitPreMeetingUpdate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/dates", () => ({
  formatMeetingDate: (d: string) => `Meeting: ${d}`,
}));

const { submitPreMeetingUpdate } = jest.requireMock("@/actions/pre-meeting");

const defaultProps = {
  positionId: "pos-1",
  selectedDate: "2026-06-01",
  upcomingMondays: ["2026-06-01", "2026-06-08", "2026-06-15"],
  existingContent: undefined,
};

describe("PreMeetingForm", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("date selector", () => {
    it("renders a button for each upcoming Monday", () => {
      render(<PreMeetingForm {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Meeting: 2026-06-01" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Meeting: 2026-06-08" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Meeting: 2026-06-15" })).toBeInTheDocument();
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

    it("calls submitPreMeetingUpdate with the correct args on valid submit", async () => {
      render(<PreMeetingForm {...defaultProps} />);
      await userEvent.type(screen.getByRole("textbox"), "Pool pump repaired.");
      fireEvent.click(screen.getByRole("button", { name: "Submit update" }));
      await waitFor(() => {
        expect(submitPreMeetingUpdate).toHaveBeenCalledWith(
          "pos-1",
          "2026-06-01",
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
        expect(screen.getByRole("button", { name: "Edit update" })).toBeInTheDocument();
      });
    });
  });

  describe("existing content (already submitted)", () => {
    const props = { ...defaultProps, existingContent: "Last month summary." };

    it("starts in the success state when existingContent is provided", () => {
      render(<PreMeetingForm {...props} />);
      expect(screen.getByText("Last month summary.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit update" })).toBeInTheDocument();
    });

    it("switches to the edit form when 'Edit update' is clicked", async () => {
      render(<PreMeetingForm {...props} />);
      await userEvent.click(screen.getByRole("button", { name: "Edit update" }));
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    });
  });
});
