import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingRunner, type MeetingRunnerProps } from "./MeetingRunner";
import type { Position } from "./types";

jest.mock("@/actions/meetings", () => ({
  adjournMeeting: jest.fn().mockResolvedValue({ uploadError: null }),
  callToOrder: jest.fn().mockResolvedValue(undefined),
  cancelMeeting: jest.fn().mockResolvedValue(undefined),
  loadMeetingRunnerState: jest.fn(),
  saveMeetingMinutes: jest.fn().mockResolvedValue(undefined),
  seedMeetingScaffold: jest.fn().mockResolvedValue({ scaffold: "<h2>Agenda</h2>" }),
  updateAttendance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/actions/motions", () => ({ recordMotion: jest.fn() }));
jest.mock("@/actions/todos", () => ({ createActionItem: jest.fn() }));

// Tiptap is not exercised here: this file is about the runner's shell. The stub
// keeps the "editor stays mounted" contract visible without a real ProseMirror.
jest.mock("@/components/hoa/RichTextEditor", () => ({
  RichTextEditor: ({ initialContent }: { initialContent?: string }) => (
    <div data-testid="minutes-editor">{initialContent}</div>
  ),
}));

const { loadMeetingRunnerState } = jest.requireMock("@/actions/meetings");

const positions: Position[] = [
  { id: "p1", name: "president", role: "president", is_voting_member: true, display_name: "Jake" },
  { id: "p2", name: "vp", role: "officer", is_voting_member: true, display_name: "Pat" },
  { id: "p3", name: "secretary", role: "officer", is_voting_member: true, display_name: "Sam" },
  { id: "p4", name: "treasurer", role: "member", is_voting_member: true, display_name: "Robin" },
];

function baseProps(overrides: Partial<MeetingRunnerProps> = {}): MeetingRunnerProps {
  return {
    positions,
    existingMeeting: null,
    onClose: jest.fn(),
    meetingId: "m1",
    meetingDate: "2026-08-17",
    quorumRequired: 3,
    ...overrides,
  };
}

/** Renders the runner behind a trigger, the way both call sites do. */
function Harness({ props }: { props: MeetingRunnerProps }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open runner
      </button>
      {open && (
        <MeetingRunner
          {...props}
          onClose={() => {
            setOpen(false);
            props.onClose();
          }}
        />
      )}
    </>
  );
}

/** Renders a meeting already under way and waits for its state to land. */
async function renderResumed(overrides: Partial<MeetingRunnerProps> = {}) {
  loadMeetingRunnerState.mockResolvedValue({
    presentPositionIds: ["p1", "p2", "p3"],
    startedAt: new Date().toISOString(),
    minutesContent: "<h2>Board Reports</h2>",
  });
  const props = baseProps({
    existingMeeting: { id: "m1", status: "in_progress" },
    ...overrides,
  });
  render(<MeetingRunner {...props} />);
  await screen.findByTestId("minutes-editor");
  return props;
}

describe("MeetingRunner shell", () => {
  beforeEach(() => jest.clearAllMocks());

  it("restores a meeting already under way", async () => {
    await renderResumed();

    expect(loadMeetingRunnerState).toHaveBeenCalledWith("m1");
    // The saved minutes reached the editor, which is what the resume gate
    // protects: adjourning against an unloaded editor wipes the record.
    expect(screen.getByTestId("minutes-editor")).toHaveTextContent("Board Reports");
    expect(screen.getByRole("button", { name: "Adjourn" })).toBeEnabled();
  });

  it("does not discard a running meeting when Escape is pressed", async () => {
    const props = await renderResumed();

    await userEvent.keyboard("{Escape}");

    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("minutes-editor")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Escape will not leave it/);
  });

  it("keeps refusing Escape however many times it is pressed", async () => {
    const props = await renderResumed();

    await userEvent.keyboard("{Escape}{Escape}{Escape}");

    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("minutes-editor")).toBeInTheDocument();
  });

  it("backs out of an overlay panel on Escape instead of leaving the meeting", async () => {
    const props = await renderResumed();
    await userEvent.click(screen.getByRole("button", { name: "Call Vote" }));
    expect(screen.getByRole("heading", { name: "Call a Vote" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("heading", { name: "Call a Vote" })).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape before the meeting has started", async () => {
    const props = baseProps();
    render(<MeetingRunner {...props} />);
    expect(screen.getByRole("heading", { name: "New Business" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(props.onClose).toHaveBeenCalled();
  });

  it("still leaves when Close is pressed during a running meeting", async () => {
    const props = await renderResumed();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it("returns focus to whatever opened it", async () => {
    const props = baseProps();
    render(<Harness props={props} />);
    const trigger = screen.getByRole("button", { name: "Open runner" });

    await userEvent.click(trigger);
    expect(screen.getByRole("heading", { name: "New Business" })).toBeInTheDocument();
    await waitFor(() => expect(trigger).not.toHaveFocus());

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
