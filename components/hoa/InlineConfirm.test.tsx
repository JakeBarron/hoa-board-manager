import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineConfirm } from "./InlineConfirm";

describe("InlineConfirm", () => {
  const baseProps = {
    message: "Are you sure?",
    onConfirm: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the message and default button labels", () => {
    render(<InlineConfirm {...baseProps} />);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(<InlineConfirm {...baseProps} confirmLabel="Yes, delete" dismissLabel="Never mind" />);
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never mind" })).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm is clicked", async () => {
    render(<InlineConfirm {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Dismiss is clicked", async () => {
    render(<InlineConfirm {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when isPending is true", () => {
    render(<InlineConfirm {...baseProps} isPending />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });
});
