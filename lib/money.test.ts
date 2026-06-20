import { parseDollarsToCents, formatCents } from "./money";

describe("parseDollarsToCents", () => {
  it("converts plain dollars to cents", () => {
    expect(parseDollarsToCents("100")).toBe(10000);
  });
  it("handles decimals", () => {
    expect(parseDollarsToCents("14181.50")).toBe(1418150);
  });
  it("strips $ and commas", () => {
    expect(parseDollarsToCents("$1,250.00")).toBe(125000);
  });
  it("returns null for empty or non-numeric", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats whole dollars", () => {
    expect(formatCents(22549700)).toBe("$225,497");
  });
  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});
