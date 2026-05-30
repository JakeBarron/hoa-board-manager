import { buildReminderMailto } from "./reminder";

const BASE_PARAMS = {
  meetingDate: "2026-06-02",
  boardEmails: ["president@yourhoa.com", "vp@yourhoa.com"],
  missingPositions: ["vp" as const],
  appUrl: "https://board.example.com",
};

describe("buildReminderMailto", () => {
  it("returns a mailto: URL", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toMatch(/^mailto:/);
  });

  it("includes all board emails in the To: field", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain("president@yourhoa.com");
    expect(result).toContain("vp@yourhoa.com");
  });

  it("includes the meeting date in the subject", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain(encodeURIComponent("2026-06-02").slice(0, 4));
  });

  it("links to /pre-meeting by default", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(result).toContain(encodeURIComponent("/pre-meeting"));
  });

  it("uses updateUrl override when provided", () => {
    const result = buildReminderMailto({
      ...BASE_PARAMS,
      updateUrl: "https://board.example.com/dashboard",
    });
    expect(result).toContain(encodeURIComponent("/dashboard"));
    expect(result).not.toContain(encodeURIComponent("/pre-meeting"));
  });

  it("lists missing board positions by label", () => {
    const result = buildReminderMailto(BASE_PARAMS);
    expect(decodeURIComponent(result)).toContain("Vice President");
  });

  it("lists missing chair positions by label", () => {
    const result = buildReminderMailto({
      ...BASE_PARAMS,
      missingPositions: ["web" as const],
    });
    expect(decodeURIComponent(result)).toContain("Web Committee");
  });
});
