import { cancelMeeting, rescheduleMeeting } from "./meetings";
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
  });

  it("throws when Supabase returns an error", async () => {
    mockChain.select.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(cancelMeeting("meeting-1")).rejects.toThrow("DB error");
  });

  it("resolves and calls revalidatePath on success", async () => {
    mockChain.select.mockResolvedValue({ data: [{ id: "meeting-1" }], error: null });
    await expect(cancelMeeting("meeting-1")).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: { id: "other-meeting" }, error: null }) });
    mockFrom.mockReturnValue(conflictChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("A meeting is already scheduled for that date");
  });

  it("throws when meeting is not pending (race condition guard)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).rejects.toThrow("Meeting is not in a reschedulable state");
  });

  it("resolves and revalidates paths on success", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = tomorrow.toISOString().split("T")[0];

    const conflictChain = buildChain({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });
    const updateChain = buildChain({ select: jest.fn().mockResolvedValue({ data: [{ id: "meeting-1" }], error: null }) });
    mockFrom.mockReturnValueOnce(conflictChain).mockReturnValueOnce(updateChain);

    await expect(rescheduleMeeting("meeting-1", newDate)).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/meetings");
    expect(revalidatePath).toHaveBeenCalledWith("/pre-meeting");
    expect(revalidatePath).toHaveBeenCalledWith("/agenda");
  });
});
