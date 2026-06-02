import { formatPersonName, POSITION_LABELS } from "./positions";

describe("POSITION_LABELS", () => {
  it("has an entry for every expected position", () => {
    const keys = Object.keys(POSITION_LABELS);
    expect(keys).toContain("president");
    expect(keys).toContain("vp");
    expect(keys).toContain("grounds");
    expect(keys).toContain("cra");
  });

  it("maps vp to Vice President", () => {
    expect(POSITION_LABELS.vp).toBe("Vice President");
  });
});

describe("formatPersonName", () => {
  it("returns role — name when display_name is set", () => {
    expect(formatPersonName("president", "Jake Barron")).toBe("President — Jake Barron");
    expect(formatPersonName("vp", "Jane Smith")).toBe("Vice President — Jane Smith");
    expect(formatPersonName("grounds", "James Connell")).toBe("Grounds — James Connell");
  });

  it("returns just the role title when display_name is null", () => {
    expect(formatPersonName("president", null)).toBe("President");
    expect(formatPersonName("secretary", null)).toBe("Secretary");
  });

  it("returns just the role title when display_name is empty string", () => {
    expect(formatPersonName("pool", "")).toBe("Pool");
  });
});
