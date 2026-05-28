import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoteForm } from "./VoteForm";

// Server actions are not available in jsdom — mock to control behavior in tests
jest.mock("@/actions/architecture", () => ({
  recordVote: jest.fn(),
}));

import { recordVote } from "@/actions/architecture";
const mockRecordVote = recordVote as jest.MockedFunction<typeof recordVote>;

const REQUEST_ID = "req-abc-123";

describe("VoteForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("collapsed state", () => {
    it("renders a 'Record vote' button initially", () => {
      render(<VoteForm requestId={REQUEST_ID} />);
      expect(
        screen.getByRole("button", { name: /record vote/i })
      ).toBeInTheDocument();
    });

    it("does not show the form until the button is clicked", () => {
      render(<VoteForm requestId={REQUEST_ID} />);
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    const openForm = async () => {
      const user = userEvent.setup();
      render(<VoteForm requestId={REQUEST_ID} />);
      await user.click(screen.getByRole("button", { name: /record vote/i }));
      return user;
    };

    it("shows the vote form after clicking 'Record vote'", async () => {
      await openForm();
      expect(
        screen.getByRole("form", { name: /vote form/i })
      ).toBeInTheDocument();
    });

    it("shows outcome select, ratio input, and notes textarea", async () => {
      await openForm();
      expect(screen.getByLabelText(/vote outcome/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/vote ratio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it("shows Save vote and Cancel buttons", async () => {
      await openForm();
      expect(
        screen.getByRole("button", { name: /save vote/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("collapses back to the toggle button when Cancel is clicked", async () => {
      const user = await openForm();
      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(
        screen.getByRole("button", { name: /record vote/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    it("shows a validation error when submitted without selecting an outcome", async () => {
      const user = await openForm();
      await user.click(screen.getByRole("button", { name: /save vote/i }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        /select a vote outcome/i
      );
      expect(mockRecordVote).not.toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    it("calls recordVote with the correct arguments on valid submit", async () => {
      mockRecordVote.mockResolvedValueOnce(undefined);
      const user = userEvent.setup();
      render(<VoteForm requestId={REQUEST_ID} />);

      await user.click(screen.getByRole("button", { name: /record vote/i }));

      // Select outcome via the native <select>
      await user.selectOptions(
        screen.getByLabelText(/vote outcome/i),
        "unanimous"
      );
      await user.type(screen.getByLabelText(/vote ratio/i), "5-2");
      await user.type(screen.getByLabelText(/notes/i), "Motion carried.");

      await user.click(screen.getByRole("button", { name: /save vote/i }));

      await waitFor(() => {
        expect(mockRecordVote).toHaveBeenCalledWith(
          REQUEST_ID,
          "unanimous",
          "5-2",
          "Motion carried."
        );
      });
    });

    it("collapses and resets the form on successful submission", async () => {
      mockRecordVote.mockResolvedValueOnce(undefined);
      const user = userEvent.setup();
      render(<VoteForm requestId={REQUEST_ID} />);

      await user.click(screen.getByRole("button", { name: /record vote/i }));
      await user.selectOptions(
        screen.getByLabelText(/vote outcome/i),
        "majority"
      );
      await user.type(screen.getByLabelText(/vote ratio/i), "7-0");

      await user.click(screen.getByRole("button", { name: /save vote/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /record vote/i })
        ).toBeInTheDocument();
      });
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    it("shows an error message when recordVote throws", async () => {
      mockRecordVote.mockRejectedValueOnce(new Error("DB error"));
      const user = userEvent.setup();
      render(<VoteForm requestId={REQUEST_ID} />);

      await user.click(screen.getByRole("button", { name: /record vote/i }));
      await user.selectOptions(
        screen.getByLabelText(/vote outcome/i),
        "denied"
      );

      await user.click(screen.getByRole("button", { name: /save vote/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /failed to record vote/i
        );
      });
    });
  });
});
