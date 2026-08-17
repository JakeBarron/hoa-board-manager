import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionItemPanel } from "./ActionItemPanel";
import type { Position } from "./types";

jest.mock("@/actions/todos", () => ({
  createActionItem: jest.fn().mockResolvedValue(undefined),
}));

const positions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: "Jake" },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: "Pat" },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof ActionItemPanel>> = {}) {
  const props = {
    positions,
    meetingId: "m1",
    onCreated: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<ActionItemPanel {...props} />);
  return props;
}

describe("ActionItemPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates the item on Enter from the description", async () => {
    const { createActionItem } = jest.requireMock("@/actions/todos");
    const props = renderPanel();

    await userEvent.type(screen.getByLabelText(/Description/), "Call the fence vendor{Enter}");

    await waitFor(() =>
      expect(createActionItem).toHaveBeenCalledWith(
        "p1",
        "Call the fence vendor",
        "m1",
        undefined
      )
    );
    expect(props.onCreated).toHaveBeenCalledWith("President — Jake", "Call the fence vendor");
  });

  it("refuses an empty description rather than creating a blank item", async () => {
    const { createActionItem } = jest.requireMock("@/actions/todos");
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Description is required.");
    expect(createActionItem).not.toHaveBeenCalled();
  });

  it("surfaces a failure instead of reporting an item that was never written", async () => {
    const { createActionItem } = jest.requireMock("@/actions/todos");
    createActionItem.mockRejectedValueOnce(new Error("row-level security"));
    const props = renderPanel();

    await userEvent.type(screen.getByLabelText(/Description/), "Call the fence vendor{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("row-level security");
    expect(props.onCreated).not.toHaveBeenCalled();
  });
});
