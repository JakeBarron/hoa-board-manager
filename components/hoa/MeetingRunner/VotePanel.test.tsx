import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VotePanel } from "./VotePanel";
import type { Position } from "./types";

jest.mock("@/actions/motions", () => ({
  recordMotion: jest.fn().mockResolvedValue({
    motionId: "motion-1",
    passed: true,
    yay: 4,
    nay: 0,
    abstain: 0,
    absent: 1,
    quorumMet: true,
  }),
}));

const votingPositions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: "Jake" },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: "Pat" },
  { id: "p3", name: "secretary", role: "officer", is_voting_member: true, display_name: "Sam" },
  { id: "p4", name: "treasurer", role: "member", is_voting_member: true, display_name: "Robin" },
  { id: "p5", name: "pool", role: "member", is_voting_member: true, display_name: "Alex" },
];

/** p5 did not attend. */
const presentIds = new Set(["p1", "p2", "p3", "p4"]);

function renderPanel(overrides: Partial<React.ComponentProps<typeof VotePanel>> = {}) {
  const props = {
    votingPositions,
    presentIds,
    meetingId: "meeting-1",
    onVoteRecorded: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<VotePanel {...props} />);
  return props;
}

const recordButton = () => screen.getByRole("button", { name: "Record Vote" });

/**
 * Scopes to one member's row in the vote list. The name also appears in the
 * proposer/seconder `<option>`s, so the span selector is what disambiguates.
 */
const voteRow = (name: string) =>
  within(screen.getByText(name, { selector: "span" }).closest("div")!);

describe("VotePanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cannot be submitted while any present member's vote is unset", async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget");

    // A title alone is not enough — the slate starts blank on purpose.
    expect(recordButton()).toBeDisabled();
    expect(screen.getByText(/Waiting on 4 votes/)).toBeInTheDocument();
  });

  it("cannot be submitted with a title missing even once everyone has voted", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));
    expect(recordButton()).toBeDisabled();
  });

  it("enables submission once a title and every present vote are in", async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget");
    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));

    expect(screen.queryByText(/Waiting on/)).not.toBeInTheDocument();
    expect(recordButton()).toBeEnabled();
  });

  it("seeds members who missed roll call as absent without assuming a vote", () => {
    renderPanel();
    // p5 was not present, so their row is already answered...
    expect(voteRow("Pool — Alex").getByRole("button", { name: "Absent" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // ...while everyone in the room is still waiting on a choice.
    expect(screen.getByText(/Waiting on 4 votes/)).toBeInTheDocument();
  });

  it("names who is still outstanding", async () => {
    renderPanel();
    await userEvent.click(voteRow("President — Jake").getByRole("button", { name: "Yay" }));
    expect(screen.getByText(/Waiting on 3 votes/)).toBeInTheDocument();
    expect(screen.getByText(/Vice President — Pat/, { selector: "p" })).toBeInTheDocument();
  });

  it("offers abstain as a distinct choice from absent", () => {
    renderPanel();
    const row = voteRow("President — Jake");
    expect(row.getByRole("button", { name: "Abstain" })).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Absent" })).toBeInTheDocument();
  });

  it("records every voting seat, marking the roll-call absentee absent", async () => {
    const { recordMotion } = jest.requireMock("@/actions/motions");
    renderPanel();

    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget");
    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));
    await userEvent.click(recordButton());

    await waitFor(() => expect(recordMotion).toHaveBeenCalled());
    const [, payload] = recordMotion.mock.calls[0];
    expect(payload.votes).toHaveLength(5);
    expect(payload.votes).toContainEqual({ positionId: "p5", vote: "absent" });
    expect(payload.votes.filter((v: { vote: string }) => v.vote === "yay")).toHaveLength(4);
  });

  it("hands back a sentence built from the server's tally", async () => {
    const props = renderPanel();
    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget");
    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));
    await userEvent.click(recordButton());

    await waitFor(() => expect(props.onVoteRecorded).toHaveBeenCalled());
    expect(props.onVoteRecorded).toHaveBeenCalledWith(
      expect.stringContaining("Passed 4–0–0 (yay–nay–abstain)")
    );
  });

  it("records the vote on Enter from the motion title", async () => {
    const { recordMotion } = jest.requireMock("@/actions/motions");
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));
    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget{Enter}");

    await waitFor(() => expect(recordMotion).toHaveBeenCalled());
  });

  it("ignores Enter while any present member's vote is unset", async () => {
    const { recordMotion } = jest.requireMock("@/actions/motions");
    renderPanel();

    // Same gate as the disabled button — Enter must not slip past it.
    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget{Enter}");

    expect(recordMotion).not.toHaveBeenCalled();
  });

  it("surfaces a failure instead of pretending the vote was recorded", async () => {
    const { recordMotion } = jest.requireMock("@/actions/motions");
    recordMotion.mockRejectedValueOnce(new Error("new row violates row-level security policy"));
    const props = renderPanel();

    await userEvent.type(screen.getByLabelText(/Motion title/), "Approve the budget");
    await userEvent.click(screen.getByRole("button", { name: "Mark all Yay" }));
    await userEvent.click(recordButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("row-level security");
    expect(props.onVoteRecorded).not.toHaveBeenCalled();
  });
});
