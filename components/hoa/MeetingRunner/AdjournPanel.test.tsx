import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdjournPanel } from "./AdjournPanel";
import type { Position } from "./types";

const presentPositions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: "Jake" },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: "Pat" },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof AdjournPanel>> = {}) {
  const props = {
    presentPositions,
    minutesLookEmpty: false,
    onAdjourn: jest.fn(),
    onCancel: jest.fn(),
    isPending: false,
    ...overrides,
  };
  const { container } = render(<AdjournPanel {...props} />);
  return { ...props, form: container.querySelector("form")! };
}

describe("AdjournPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adjourns with the chosen mover and seconder", async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Formally Adjourn" }));
    expect(props.onAdjourn).toHaveBeenCalledWith("p1", "p2");
  });

  // Enter in a browser performs implicit form submission; jsdom only does that
  // from a text input, and this panel is two selects, so the submit event
  // stands in for the keystroke.
  it("adjourns when the form is submitted", () => {
    const props = renderPanel();
    fireEvent.submit(props.form);
    expect(props.onAdjourn).toHaveBeenCalledWith("p1", "p2");
  });

  it("does not adjourn twice while the first request is in flight", () => {
    const props = renderPanel({ isPending: true });
    fireEvent.submit(props.form);
    expect(props.onAdjourn).not.toHaveBeenCalled();
  });

  it("warns when the minutes still look untouched", () => {
    renderPanel({ minutesLookEmpty: true });
    expect(screen.getByRole("alert")).toHaveTextContent(/No minutes have been written/);
  });
});
