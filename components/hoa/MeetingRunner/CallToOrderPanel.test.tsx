import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallToOrderPanel } from "./CallToOrderPanel";
import type { Position } from "./types";

const presentPositions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: "Jake" },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: "Pat" },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof CallToOrderPanel>> = {}) {
  const props = {
    presentPositions,
    onConfirm: jest.fn(),
    onBack: jest.fn(),
    isPending: false,
    ...overrides,
  };
  const { container } = render(<CallToOrderPanel {...props} />);
  return { ...props, form: container.querySelector("form")! };
}

describe("CallToOrderPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts the meeting with the chosen mover and seconder", async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Start Meeting" }));
    expect(props.onConfirm).toHaveBeenCalledWith("p1", "p2");
  });

  // Enter in a browser performs implicit form submission; jsdom only does that
  // from a text input, and this panel is two selects, so the submit event
  // stands in for the keystroke.
  it("starts the meeting when the form is submitted", () => {
    const props = renderPanel();
    fireEvent.submit(props.form);
    expect(props.onConfirm).toHaveBeenCalledWith("p1", "p2");
  });

  it("does not start while a request is already in flight", () => {
    const props = renderPanel({ isPending: true });
    fireEvent.submit(props.form);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("goes back to attendance without starting anything", async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
