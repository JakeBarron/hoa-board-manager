import { buildMeetingScaffold, type MeetingScaffoldInput } from "./agenda";

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
    // Pool submitted nothing → placeholder under its heading
    expect(html).toContain("<h3>Pool</h3><p><em>No update submitted.</em></p>");
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
