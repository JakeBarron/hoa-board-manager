import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendancePanel } from "./AttendancePanel";
import type { Position } from "./types";

/** Four voting seats plus a treasurer who holds no vote. */
const positions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: null },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: null },
  { id: "p3", name: "secretary", role: "officer", is_voting_member: true, display_name: null },
  { id: "p4", name: "pool", role: "member", is_voting_member: true, display_name: null },
  { id: "p5", name: "treasurer", role: "member", is_voting_member: false, display_name: null },
];

function renderPanel(
  presentIds: Set<string>,
  overrides: Partial<React.ComponentProps<typeof AttendancePanel>> = {}
) {
  const props = {
    positions,
    presentIds,
    quorumRequired: 4,
    onToggle: jest.fn(),
    onMarkAllPresent: jest.fn(),
    onProceed: jest.fn(),
    isPending: false,
    ...overrides,
  };
  render(<AttendancePanel {...props} />);
  return props;
}

const proceedButton = () =>
  screen.getByRole("button", { name: "Proceed to Call to Order" });

describe("AttendancePanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks the meeting from starting when nobody has been marked present", () => {
    renderPanel(new Set());
    expect(screen.getByText(/0 voting members present/)).toBeInTheDocument();
    expect(screen.getByText(/not met/)).toBeInTheDocument();
    expect(proceedButton()).toBeDisabled();
  });

  it("counts voting members only — a non-voting seat does not make quorum", () => {
    // Four in the room, but one of them holds no vote.
    renderPanel(new Set(["p1", "p2", "p3", "p5"]));
    expect(screen.getByText(/3 voting members present/)).toBeInTheDocument();
    expect(proceedButton()).toBeDisabled();
  });

  it("allows the meeting to start once enough voting members are present", () => {
    renderPanel(new Set(["p1", "p2", "p3", "p4"]));
    expect(screen.getByText(/4 voting members present/)).toBeInTheDocument();
    expect(proceedButton()).toBeEnabled();
  });

  it("marks each row with its attendance state", () => {
    renderPanel(new Set(["p1"]));
    expect(screen.getByRole("button", { name: /^President /  })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Vice President / })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("toggles a single position", async () => {
    const props = renderPanel(new Set());
    await userEvent.click(screen.getByRole("button", { name: /^President /  }));
    expect(props.onToggle).toHaveBeenCalledWith("p1");
  });

  it("offers a one-tap way to mark the whole board present", async () => {
    const props = renderPanel(new Set());
    await userEvent.click(screen.getByRole("button", { name: "Mark all present" }));
    expect(props.onMarkAllPresent).toHaveBeenCalled();
  });

  it("uses the singular when exactly one voting member is present", () => {
    renderPanel(new Set(["p1"]));
    expect(screen.getByText(/1 voting member present/)).toBeInTheDocument();
  });
});
