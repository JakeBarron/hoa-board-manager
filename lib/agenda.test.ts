import {
  buildMeetingScaffold,
  buildVoteResultText,
  type MeetingScaffoldInput,
  type VoteResultTextInput,
} from "./agenda";

function baseInput(overrides: Partial<MeetingScaffoldInput> = {}): MeetingScaffoldInput {
  return {
    calledByName: "President — Jake Barron",
    secondedByName: "Vice President — Pat Lee",
    presentNames: ["President — Jake Barron", "Vice President — Pat Lee"],
    quorumMet: true,
    priorMinutes: { date: "2026-05-19", url: "https://drive.example/min" },
    boardReports: [
      { label: "Treasurer", content: "Operating balance is $42,000." },
      { label: "Pool", content: null },
    ],
    committeeReports: [{ label: "Architecture Review", content: "Two requests pending." }],
    newBusiness: [{ title: "Fence vendor quote", note: "review 3 bids" }],
    ...overrides,
  };
}

describe("buildMeetingScaffold", () => {
  it("renders all standard sections in meeting order", () => {
    const html = buildMeetingScaffold(baseInput());
    const order = [
      "Call to Order",
      "Approval of Prior Minutes",
      "Board Reports",
      "Committee Reports",
      "New Business",
      "Adjournment",
    ];
    let lastIndex = -1;
    for (const heading of order) {
      const idx = html.indexOf(`<h2>${heading}</h2>`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("includes caller, seconder, attendance, and quorum status", () => {
    const html = buildMeetingScaffold(baseInput());
    expect(html).toContain("Called to order by President — Jake Barron, seconded by Vice President — Pat Lee");
    expect(html).toContain("Present: President — Jake Barron, Vice President — Pat Lee");
    expect(html).toContain("Quorum met.");
  });

  it("says quorum not met when quorum fails", () => {
    const html = buildMeetingScaffold(baseInput({ quorumMet: false }));
    expect(html).toContain("Quorum not met.");
  });

  it("renders submitted updates and a placeholder for missing ones", () => {
    const html = buildMeetingScaffold(baseInput());
    expect(html).toContain("Operating balance is $42,000.");
    // Pool submitted nothing → dash placeholder under its heading
    expect(html).toContain("<h3>Pool</h3><p>—</p>");
  });

  it("links prior minutes when a URL is present", () => {
    const html = buildMeetingScaffold(baseInput());
    expect(html).toContain('<a href="https://drive.example/min">View minutes</a>');
  });

  it("notes when there are no prior minutes", () => {
    const html = buildMeetingScaffold(baseInput({ priorMinutes: null }));
    expect(html).toContain("No prior minutes on file.");
  });

  it("renders prior minutes without a link when URL is null", () => {
    const html = buildMeetingScaffold(baseInput({ priorMinutes: { date: "2026-05-19", url: null } }));
    expect(html).toContain("Minutes of");
    expect(html).not.toContain("<a href");
  });

  it("lists new business items with their notes", () => {
    const html = buildMeetingScaffold(baseInput());
    expect(html).toContain("<li>Fence vendor quote: review 3 bids</li>");
  });

  it("shows 'None.' when there is no new business", () => {
    const html = buildMeetingScaffold(baseInput({ newBusiness: [] }));
    expect(html).toContain("<h2>New Business</h2><p><em>None.</em></p>");
  });

  it("renders a new business item without a note", () => {
    const html = buildMeetingScaffold(baseInput({ newBusiness: [{ title: "Welcome new homeowner" }] }));
    expect(html).toContain("<li>Welcome new homeowner</li>");
  });

  it("handles no members present", () => {
    const html = buildMeetingScaffold(baseInput({ presentNames: [] }));
    expect(html).toContain("Present: None recorded.");
  });

  it("escapes HTML in user-provided content", () => {
    const html = buildMeetingScaffold(baseInput({
      newBusiness: [{ title: "Discuss <script>alert(1)</script>" }],
      boardReports: [{ label: "Treasurer", content: "Balance < expected & low" }],
    }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Balance &lt; expected &amp; low");
  });

  it("converts newlines in updates to hard breaks", () => {
    const html = buildMeetingScaffold(baseInput({
      boardReports: [{ label: "Treasurer", content: "Line one\nLine two" }],
    }));
    expect(html).toContain("Line one<br>Line two");
  });
});

function voteInput(
  overrides: Partial<VoteResultTextInput> = {}
): VoteResultTextInput {
  return {
    title: "approve the fence repair budget",
    callerName: "President — Jake Barron",
    seconderName: "Vice President — Pat Lee",
    tally: { yay: 2, nay: 0, abstain: 0, absent: 0, passed: true },
    votes: [
      { name: "President — Jake Barron", vote: "yay" },
      { name: "Vice President — Pat Lee", vote: "yay" },
    ],
    ...overrides,
  };
}

describe("buildVoteResultText", () => {
  it("counts abstentions in the tally instead of dropping them", () => {
    const text = buildVoteResultText(
      voteInput({
        tally: { yay: 3, nay: 1, abstain: 2, absent: 0, passed: true },
        votes: [
          { name: "A", vote: "yay" },
          { name: "B", vote: "yay" },
          { name: "C", vote: "yay" },
          { name: "D", vote: "nay" },
          { name: "E", vote: "no_vote" },
          { name: "F", vote: "no_vote" },
        ],
      })
    );

    expect(text).toContain("Passed 3–1–2 (yay–nay–abstain)");
    expect(text).toContain("Abstained: E, F.");
    expect(text).not.toContain("3–1–0");
  });

  it("reports unanimous when nobody dissented, abstained, or was absent", () => {
    const text = buildVoteResultText(voteInput());
    expect(text).toContain("Passed 2–0–0 (yay–nay–abstain). Unanimous.");
  });

  it("names dissenters, abstainers, and absentees separately", () => {
    const text = buildVoteResultText(
      voteInput({
        tally: { yay: 1, nay: 1, abstain: 1, absent: 1, passed: false },
        votes: [
          { name: "A", vote: "yay" },
          { name: "B", vote: "nay" },
          { name: "C", vote: "no_vote" },
          { name: "D", vote: "absent" },
        ],
      })
    );

    expect(text).toContain("Nay: B.");
    expect(text).toContain("Abstained: C.");
    expect(text).toContain("Absent: D.");
  });

  it("trusts the server tally rather than recomputing the outcome", () => {
    // yay outnumbers nay, but the server said it failed — the prose must agree
    // with the persisted motion row, not second-guess it.
    const text = buildVoteResultText(
      voteInput({
        tally: { yay: 5, nay: 1, abstain: 0, absent: 0, passed: false },
      })
    );

    expect(text).toContain("Failed 5–1–0");
    expect(text).not.toContain("Passed");
  });

  it("folds the description into the motion title when present", () => {
    const text = buildVoteResultText(
      voteInput({ title: "approve the budget", description: "$4,500 to Acme" })
    );
    expect(text).toContain("Motion to approve the budget: $4,500 to Acme —");
  });

  it("omits the description separator when there is none", () => {
    const text = buildVoteResultText(voteInput({ description: null }));
    expect(text).toContain("Motion to approve the fence repair budget — called by");
  });
});
