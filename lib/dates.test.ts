import {
  getUpcomingMondays,
  formatMeetingDate,
  parseCadence,
  describeCadence,
  getUpcomingMeetingDates,
} from "./dates";

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

describe("parseCadence", () => {
  it("parses a valid cadence string", () => {
    expect(parseCadence("3:2")).toEqual({ week: 3, dayOfWeek: 2 });
    expect(parseCadence("1:0")).toEqual({ week: 1, dayOfWeek: 0 });
    expect(parseCadence("5:6")).toEqual({ week: 5, dayOfWeek: 6 });
  });

  it("returns null for malformed strings", () => {
    expect(parseCadence("invalid")).toBeNull();
    expect(parseCadence("3")).toBeNull();
    expect(parseCadence("3:2:1")).toBeNull();
  });

  it("returns null for out-of-range values", () => {
    expect(parseCadence("0:2")).toBeNull(); // week < 1
    expect(parseCadence("6:2")).toBeNull(); // week > 5
    expect(parseCadence("3:7")).toBeNull(); // dayOfWeek > 6
    expect(parseCadence("3:-1")).toBeNull(); // dayOfWeek < 0
  });
});

describe("describeCadence", () => {
  it('describes "3:2" as 3rd Tuesday', () => {
    expect(describeCadence("3:2")).toBe("3rd Tuesday of each month");
  });

  it('describes "1:1" as 1st Monday', () => {
    expect(describeCadence("1:1")).toBe("1st Monday of each month");
  });

  it('describes "5:5" as Last Friday', () => {
    expect(describeCadence("5:5")).toBe("Last Friday of each month");
  });

  it("returns the raw value for invalid cadence", () => {
    expect(describeCadence("bad")).toBe("bad");
  });
});

describe("getUpcomingMeetingDates", () => {
  // May 1 2026 is a Friday.
  // 3rd Tuesday of May 2026: first Tue = May 5, 3rd = May 19.
  // 3rd Tuesday of Jun 2026: first Tue = Jun 2, 3rd = Jun 16.
  // 3rd Tuesday of Jul 2026: first Tue = Jul 7, 3rd = Jul 21.

  it("returns the 3rd Tuesday of each upcoming month", () => {
    const from = new Date("2026-05-01T00:00:00");
    const result = getUpcomingMeetingDates("3:2", 3, from);
    expect(result).toEqual(["2026-05-19", "2026-06-16", "2026-07-21"]);
  });

  it("includes the meeting day itself when from equals the meeting date", () => {
    const from = new Date("2026-05-19T00:00:00"); // is the 3rd Tuesday
    const [first] = getUpcomingMeetingDates("3:2", 1, from);
    expect(first).toBe("2026-05-19");
  });

  it("skips the current month when from is after the meeting date", () => {
    const from = new Date("2026-05-20T00:00:00"); // day after 3rd Tuesday
    const [first] = getUpcomingMeetingDates("3:2", 1, from);
    expect(first).toBe("2026-06-16");
  });

  it("wraps correctly across year boundaries", () => {
    const from = new Date("2026-12-01T00:00:00");
    // 3rd Tuesday of Dec 2026: Dec 1 is Tuesday, 3rd = Dec 15.
    // 3rd Tuesday of Jan 2027: Jan 1 is Friday, first Tue = Jan 5, 3rd = Jan 19.
    const [dec, jan] = getUpcomingMeetingDates("3:2", 2, from);
    expect(dec).toBe("2026-12-15");
    expect(jan).toBe("2027-01-19");
  });

  it("falls back to upcoming Mondays for an invalid cadence", () => {
    const from = new Date("2026-05-25T00:00:00"); // Monday
    const result = getUpcomingMeetingDates("bad", 1, from);
    expect(result[0]).toBe("2026-05-25");
  });
});
