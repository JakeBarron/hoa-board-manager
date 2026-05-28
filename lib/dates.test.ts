import { getUpcomingMondays, formatMeetingDate } from "./dates";

describe("getUpcomingMondays", () => {
  it("returns the given Monday when from is already a Monday", () => {
    const monday = new Date("2026-05-25T12:00:00"); // a Monday
    const result = getUpcomingMondays(3, monday);
    expect(result[0]).toBe("2026-05-25");
    expect(result).toHaveLength(3);
  });

  it("returns the next Monday when from is a Tuesday", () => {
    const tuesday = new Date("2026-05-26T12:00:00");
    const result = getUpcomingMondays(1, tuesday);
    expect(result[0]).toBe("2026-06-01");
  });

  it("returns the next Monday when from is a Sunday", () => {
    const sunday = new Date("2026-05-31T12:00:00");
    const result = getUpcomingMondays(1, sunday);
    expect(result[0]).toBe("2026-06-01");
  });

  it("returns consecutive Mondays 7 days apart", () => {
    const monday = new Date("2026-05-25T00:00:00");
    const [a, b, c] = getUpcomingMondays(3, monday);
    expect(a).toBe("2026-05-25");
    expect(b).toBe("2026-06-01");
    expect(c).toBe("2026-06-08");
  });
});

describe("formatMeetingDate", () => {
  it("formats an ISO date string for display", () => {
    const result = formatMeetingDate("2026-05-25");
    expect(result).toMatch(/May/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2026/);
  });
});
