import { recordMotion } from "./motions";
import { createClient } from "@/lib/supabase/server";
import type { VoteChoice } from "@/types/database";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

/** Methods that keep the Supabase query builder chainable. */
const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "eq",
  "in",
  "single",
  "maybeSingle",
] as const;

/**
 * Builds a chainable query stub. Any method named in `resolvers` resolves with
 * the given value instead of chaining, making it the terminal call.
 */
function chain(resolvers: Record<string, unknown> = {}) {
  const stub: Record<string, jest.Mock> = {};
  for (const method of CHAIN_METHODS) {
    stub[method] = jest.fn().mockReturnValue(stub);
  }
  for (const [method, value] of Object.entries(resolvers)) {
    stub[method] = jest.fn().mockResolvedValue(value);
  }
  return stub;
}

/**
 * Installs a mock Supabase client that dispatches `from(table)` to a per-table
 * queue, so a test only describes the queries it cares about.
 */
function mockClient(queues: Record<string, ReturnType<typeof chain>[]>) {
  const from = jest.fn((table: string) => {
    const queue = queues[table];
    if (!queue?.length) throw new Error(`unexpected from("${table}")`);
    return queue.length === 1 ? queue[0] : queue.shift()!;
  });
  (createClient as jest.Mock).mockResolvedValue({
    from,
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { email: "secretary@example.com" } } }),
    },
  });
  return from;
}

/** The queues for a well-formed recordMotion run. */
function happyPath({
  role = "officer",
  storedVotes = [{ vote: "yay" }, { vote: "yay" }],
  presentPositions = ["a", "b", "c", "d", "e"],
  votingPresent = ["a", "b", "c", "d", "e"],
  quorum = "5",
}: {
  role?: string;
  storedVotes?: { vote: VoteChoice | string }[];
  presentPositions?: string[];
  votingPresent?: string[];
  quorum?: string;
} = {}) {
  return {
    positions: [
      chain({ single: { data: { id: "operator", role } } }),
      chain({ eq: { data: votingPresent.map((id) => ({ id })) } }),
    ],
    motions: [
      chain({ single: { data: { id: "motion-1" }, error: null } }),
      chain({ eq: { error: null } }),
    ],
    motion_votes: [
      chain({ upsert: { error: null } }),
      chain({ eq: { data: storedVotes, error: null } }),
    ],
    meetings: [chain({ single: { data: { present_positions: presentPositions } } })],
    settings: [chain({ maybeSingle: { data: { value: quorum } } })],
  };
}

const input = {
  title: "approve the fence repair",
  proposedBy: "a",
  secondedBy: "b",
  votes: [
    { positionId: "a", vote: "yay" as VoteChoice },
    { positionId: "b", vote: "yay" as VoteChoice },
  ],
};

describe("recordMotion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("refuses a caller who is not an officer or the president", async () => {
    mockClient(happyPath({ role: "member" }));
    await expect(recordMotion("meeting-1", input)).rejects.toThrow(
      "Only the president or an officer"
    );
  });

  it("allows a non-president officer to record — the secretary runs the meeting", async () => {
    mockClient(happyPath({ role: "officer" }));
    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      motionId: "motion-1",
    });
  });

  it("rejects a blank title", async () => {
    mockClient(happyPath());
    await expect(recordMotion("meeting-1", { ...input, title: "   " })).rejects.toThrow(
      "Motion title is required"
    );
  });

  it("rejects a proposer who is also the seconder", async () => {
    mockClient(happyPath());
    await expect(
      recordMotion("meeting-1", { ...input, secondedBy: "a" })
    ).rejects.toThrow("cannot also second");
  });

  it("rejects an empty vote slate", async () => {
    mockClient(happyPath());
    await expect(recordMotion("meeting-1", { ...input, votes: [] })).rejects.toThrow(
      "At least one vote"
    );
  });

  it("tallies from the persisted rows, not from what the caller sent", async () => {
    // The caller claims two unanimous yays; the database holds something else.
    mockClient(
      happyPath({
        storedVotes: [{ vote: "yay" }, { vote: "nay" }, { vote: "nay" }],
      })
    );

    const result = await recordMotion("meeting-1", input);

    expect(result).toMatchObject({ yay: 1, nay: 2, passed: false });
  });

  it("counts abstentions separately from absences", async () => {
    mockClient(
      happyPath({
        storedVotes: [
          { vote: "yay" },
          { vote: "yay" },
          { vote: "no_vote" },
          { vote: "absent" },
        ],
      })
    );

    const result = await recordMotion("meeting-1", input);

    expect(result).toMatchObject({ yay: 2, nay: 0, abstain: 1, absent: 1 });
  });

  it("fails a motion when nays match yays — a tie does not carry", async () => {
    mockClient(happyPath({ storedVotes: [{ vote: "yay" }, { vote: "nay" }] }));
    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      passed: false,
    });
  });

  it("writes votes with ignoreDuplicates so a retry cannot mutate a recorded vote", async () => {
    const queues = happyPath();
    // Captured up front: the dispatcher shifts the queue as it serves it.
    const upsertQuery = queues.motion_votes[0];
    mockClient(queues);

    await recordMotion("meeting-1", input);

    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ignoreDuplicates: true })
    );
  });

  it("meets quorum when enough voting members are present", async () => {
    mockClient(happyPath({ votingPresent: ["a", "b", "c", "d", "e"], quorum: "5" }));
    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      quorumMet: true,
    });
  });

  it("misses quorum when the present members are mostly non-voting", async () => {
    // Seven people in the room, but only four of them hold a vote.
    mockClient(
      happyPath({
        presentPositions: ["a", "b", "c", "d", "e", "f", "g"],
        votingPresent: ["a", "b", "c", "d"],
        quorum: "5",
      })
    );
    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      quorumMet: false,
    });
  });

  it("falls back to a quorum of 5 when the setting is missing", async () => {
    const queues = happyPath({ votingPresent: ["a", "b", "c", "d"] });
    queues.settings = [chain({ maybeSingle: { data: null } })];
    mockClient(queues);

    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      quorumMet: false,
    });
  });

  it("reports no quorum when attendance was never recorded", async () => {
    mockClient(happyPath({ presentPositions: [], votingPresent: [] }));
    await expect(recordMotion("meeting-1", input)).resolves.toMatchObject({
      quorumMet: false,
    });
  });
});
