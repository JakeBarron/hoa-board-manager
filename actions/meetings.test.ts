import { cancelMeeting, rescheduleMeeting, createMeeting, callToOrder } from "./meetings";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/supabase/server");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["from", "select", "update", "delete", "insert", "eq", "neq", "in", "lt", "gt", "limit", "order", "maybeSingle", "single"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  return Object.assign(chain, overrides);
}

function getFutureDate(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

/**
 * Returns a date clearly in the past in America/New_York, matching the timezone
 * the action functions use for validation. Using a fixed past date avoids the
 * UTC-vs-Eastern mismatch that can occur in CI when UTC and Eastern dates differ.
 */
function getPastDate(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

describe("cancelMeeting", () => {
  let mockChain: ReturnType<typeof buildChain>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = buildChain();
    (createClient as jest.Mock).mockResolvedValue({ from: jest.fn().mockReturnValue(mockChain) });
  });

  it("throws when the meeting is not in a cancellable state (no rows deleted)", async () => {
    mockChain.select.mockResolvedValue({ data: [], error: null });
    await expect(cancelMeeting("meeting-1")).rejects.toThrow("Meeting is not in a cancellable state");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when Supabase returns an error", async () => {
    mockChain.select.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(cancelMeeting("meeting-1")).rejects.toThrow("DB error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("resolves and calls revalidatePath on success", async () => {
    mockChain.select.mockResolvedValue({ data: [{ id: "meeting-1" }], error: null });
    await expect(cancelMeeting("meeting-1")).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

describe("createMeeting (append-only queue)", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  it("throws when date is in the past", async () => {
    await expect(createMeeting("pos-1", getPastDate())).rejects.toThrow("Date must be in the future");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when the date is not after the last scheduled meeting", async () => {
    const last = getFutureDate(5);
    const earlier = getFutureDate(3);
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { meeting_date: last }, error: null }) });
    mockFrom.mockReturnValue(latestChain);
    await expect(createMeeting("pos-1", earlier)).rejects.toThrow("New meetings must be scheduled after the last scheduled meeting");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when the date equals the last scheduled meeting", async () => {
    const last = getFutureDate(5);
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { meeting_date: last }, error: null }) });
    mockFrom.mockReturnValue(latestChain);
    await expect(createMeeting("pos-1", last)).rejects.toThrow("New meetings must be scheduled after the last scheduled meeting");
  });

  it("throws when the latest-meeting query returns a DB error", async () => {
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: "latest query failed" } }) });
    mockFrom.mockReturnValue(latestChain);
    await expect(createMeeting("pos-1", getFutureDate())).rejects.toThrow("latest query failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when the insert fails", async () => {
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const insertChain = buildChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } }) });
    mockFrom.mockReturnValueOnce(latestChain).mockReturnValueOnce(insertChain);
    await expect(createMeeting("pos-1", getFutureDate())).rejects.toThrow("insert failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("inserts when the queue is empty and revalidates on success", async () => {
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const insertChain = buildChain({ single: jest.fn().mockResolvedValue({ data: { id: "new-meeting" }, error: null }) });
    mockFrom.mockReturnValueOnce(latestChain).mockReturnValueOnce(insertChain);
    const result = await createMeeting("pos-1", getFutureDate());
    expect(result).toEqual({ id: "new-meeting" });
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).not.toHaveBeenCalledWith("/agenda");
  });

  it("appends when the new date is after the last scheduled meeting", async () => {
    const last = getFutureDate(3);
    const after = getFutureDate(10);
    const latestChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { meeting_date: last }, error: null }) });
    const insertChain = buildChain({ single: jest.fn().mockResolvedValue({ data: { id: "new-meeting" }, error: null }) });
    mockFrom.mockReturnValueOnce(latestChain).mockReturnValueOnce(insertChain);
    await expect(createMeeting("pos-1", after)).resolves.toEqual({ id: "new-meeting" });
  });
});

describe("rescheduleMeeting (order-preserving)", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  /** Chain for the "all scheduled meetings" query (terminal `.in`). */
  function scheduledChain(rows: { id: string; meeting_date: string }[] | null, error: unknown = null) {
    return buildChain({ in: jest.fn().mockResolvedValue({ data: rows, error }) });
  }

  /** Chain for the update query (terminal `.select`). */
  function updateChain(rows: { id: string }[], error: unknown = null) {
    return buildChain({ select: jest.fn().mockResolvedValue({ data: rows, error }) });
  }

  it("throws on an invalid date string", async () => {
    await expect(rescheduleMeeting("meeting-1", "not-a-date")).rejects.toThrow("Invalid date");
  });

  it("throws when date is today or in the past", async () => {
    await expect(rescheduleMeeting("meeting-1", getPastDate())).rejects.toThrow("Date must be in the future");
  });

  it("throws when the scheduled-meetings query returns a DB error", async () => {
    mockFrom.mockReturnValue(scheduledChain(null, { message: "scheduled query failed" }));
    await expect(rescheduleMeeting("meeting-1", getFutureDate())).rejects.toThrow("scheduled query failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when the meeting is not among scheduled meetings", async () => {
    mockFrom.mockReturnValue(scheduledChain([{ id: "other", meeting_date: getFutureDate(2) }]));
    await expect(rescheduleMeeting("meeting-1", getFutureDate())).rejects.toThrow("Meeting is not in a reschedulable state");
  });

  it("throws when another meeting is already scheduled on that date", async () => {
    const newDate = getFutureDate(4);
    mockFrom.mockReturnValue(scheduledChain([
      { id: "meeting-1", meeting_date: getFutureDate(2) },
      { id: "other", meeting_date: newDate },
    ]));
    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("A meeting is already scheduled for that date");
  });

  it("throws when the move would jump before an earlier meeting", async () => {
    // meeting-1 currently at day 5, earlier meeting at day 3; moving to day 2 crosses it
    mockFrom.mockReturnValue(scheduledChain([
      { id: "meeting-1", meeting_date: getFutureDate(5) },
      { id: "earlier", meeting_date: getFutureDate(3) },
    ]));
    await expect(rescheduleMeeting("meeting-1", getFutureDate(2))).rejects.toThrow("Cannot move a meeting before an earlier scheduled meeting");
  });

  it("throws when the move would jump after a later meeting", async () => {
    // meeting-1 currently at day 2, later meeting at day 5; moving to day 8 crosses it
    mockFrom.mockReturnValue(scheduledChain([
      { id: "meeting-1", meeting_date: getFutureDate(2) },
      { id: "later", meeting_date: getFutureDate(5) },
    ]));
    await expect(rescheduleMeeting("meeting-1", getFutureDate(8))).rejects.toThrow("Cannot move a meeting after a later scheduled meeting");
  });

  it("throws when meeting is not pending at update time (race condition guard)", async () => {
    mockFrom
      .mockReturnValueOnce(scheduledChain([{ id: "meeting-1", meeting_date: getFutureDate(2) }]))
      .mockReturnValueOnce(updateChain([]));
    await expect(rescheduleMeeting("meeting-1", getFutureDate(4))).rejects.toThrow("Meeting is not in a reschedulable state");
  });

  it("resolves and revalidates paths on success (move within slot)", async () => {
    mockFrom
      .mockReturnValueOnce(scheduledChain([
        { id: "meeting-1", meeting_date: getFutureDate(5) },
        { id: "earlier", meeting_date: getFutureDate(2) },
        { id: "later", meeting_date: getFutureDate(10) },
      ]))
      .mockReturnValueOnce(updateChain([{ id: "meeting-1" }]));
    await expect(rescheduleMeeting("meeting-1", getFutureDate(6))).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).not.toHaveBeenCalledWith("/agenda");
  });
});

describe("callToOrder (earliest-first guard)", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  /** Chain for the earliest-scheduled query (terminal `.maybeSingle`). */
  function earliestChain(row: { id: string; status: string } | null, error: unknown = null) {
    return buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: row, error }) });
  }

  /** Chain for the update query (terminal `.eq`). */
  function updateChain(error: unknown = null) {
    return buildChain({ eq: jest.fn().mockResolvedValue({ error }) });
  }

  it("throws when an earlier pending meeting exists", async () => {
    mockFrom.mockReturnValue(earliestChain({ id: "earlier", status: "pending" }));
    await expect(callToOrder("meeting-1", "a", "b", ["a"])).rejects.toThrow("An earlier meeting must be started first");
  });

  it("throws when another meeting is already in progress", async () => {
    mockFrom.mockReturnValue(earliestChain({ id: "other", status: "in_progress" }));
    await expect(callToOrder("meeting-1", "a", "b", ["a"])).rejects.toThrow("Another meeting is already in progress");
  });

  it("starts the meeting when it is the earliest scheduled", async () => {
    mockFrom
      .mockReturnValueOnce(earliestChain({ id: "meeting-1", status: "pending" }))
      .mockReturnValueOnce(updateChain(null));
    await expect(callToOrder("meeting-1", "a", "b", ["a", "b"])).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
