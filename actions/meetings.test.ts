import { cancelMeeting, rescheduleMeeting, createMeeting } from "./meetings";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/supabase/server");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["from", "select", "update", "delete", "insert", "eq", "neq", "in", "limit", "order", "maybeSingle", "single"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  return Object.assign(chain, overrides);
}

function getFutureDate(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
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

describe("rescheduleMeeting", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  it("throws on an invalid date string", async () => {
    await expect(rescheduleMeeting("meeting-1", "not-a-date")).rejects.toThrow("Invalid date");
  });

  it("throws when date is today or in the past", async () => {
    const today = new Date().toISOString().split("T")[0];
    await expect(rescheduleMeeting("meeting-1", today)).rejects.toThrow("Date must be in the future");
  });

  it("throws when another meeting is already scheduled on that date", async () => {
    const newDate = getFutureDate();

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: "other-meeting" }, error: null }) });
    mockFrom.mockReturnValue(conflictChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("A meeting is already scheduled for that date");
  });

  it("throws when the conflict query returns a DB error", async () => {
    const tomorrow = getFutureDate();
    const conflictChain = buildChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: "conflict query failed" } }),
    });
    mockFrom.mockReturnValue(conflictChain);
    await expect(rescheduleMeeting("meeting-1", tomorrow)).rejects.toThrow("conflict query failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when meeting is not pending (race condition guard)", async () => {
    const newDate = getFutureDate();

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("Meeting is not in a reschedulable state");
  });

  it("resolves and revalidates paths on success", async () => {
    const newDate = getFutureDate();

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [{ id: "meeting-1" }], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/pre-meeting");
    expect(revalidatePath).toHaveBeenCalledWith("/agenda");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

describe("createMeeting", () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ from: mockFrom });
  });

  it("throws when date is in the past", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split("T")[0];
    await expect(createMeeting("pos-1", pastDate)).rejects.toThrow("Date must be in the future");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when a meeting is already scheduled on that date", async () => {
    const futureDate = getFutureDate();
    const conflictChain = buildChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
    });
    mockFrom.mockReturnValue(conflictChain);
    await expect(createMeeting("pos-1", futureDate)).rejects.toThrow("A meeting is already scheduled for that date");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the new meeting id and revalidates on success", async () => {
    const futureDate = getFutureDate();
    const conflictChain = buildChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const insertChain = buildChain({
      single: jest.fn().mockResolvedValue({ data: { id: "new-meeting" }, error: null }),
    });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(insertChain);
    const result = await createMeeting("pos-1", futureDate);
    expect(result).toEqual({ id: "new-meeting" });
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/agenda");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
