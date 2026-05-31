import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineDateInput } from "./InlineDateInput";

describe("InlineDateInput", () => {
  const baseProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders a date input and Save/Cancel buttons", () => {
    const { container } = render(<InlineDateInput {...baseProps} />);
    expect(container.querySelector("input[type='date']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onSave with the selected date when Save is clicked", async () => {
    const minDate = "2026-06-01";
    const { container } = render(<InlineDateInput {...baseProps} minDate={minDate} />);
    const input = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-06-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(baseProps.onSave).toHaveBeenCalledWith("2026-06-10");
  });

  it("does not call onSave when no date is selected", async () => {
    render(<InlineDateInput {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(baseProps.onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    render(<InlineDateInput {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Save and Cancel when isPending is true", () => {
    render(<InlineDateInput {...baseProps} isPending />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("renders with a pre-filled defaultValue", () => {
    render(<InlineDateInput {...baseProps} defaultValue="2026-07-08" />);
    expect(screen.getByDisplayValue("2026-07-08")).toBeInTheDocument();
  });
});
