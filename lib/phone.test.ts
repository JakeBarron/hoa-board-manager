import { formatPhone, isValidPhone } from "./phone";

describe("formatPhone", () => {
  it("formats 10 raw digits as (xxx) xxx-xxxx", () => {
    expect(formatPhone("7705551234")).toBe("(770) 555-1234");
  });

  it("reformats an already-formatted number", () => {
    expect(formatPhone("(770) 555-1234")).toBe("(770) 555-1234");
  });

  it("strips a leading 1 country code", () => {
    expect(formatPhone("17705551234")).toBe("(770) 555-1234");
    expect(formatPhone("+1 (770) 555-1234")).toBe("(770) 555-1234");
  });

  it("formats numbers with mixed separators", () => {
    expect(formatPhone("770.555.1234")).toBe("(770) 555-1234");
    expect(formatPhone("770 555 1234")).toBe("(770) 555-1234");
  });

  it("returns the input unchanged when it is not a valid 10-digit number", () => {
    expect(formatPhone("555-1234")).toBe("555-1234");
    expect(formatPhone("770555")).toBe("770555");
    expect(formatPhone("")).toBe("");
  });
});

describe("isValidPhone", () => {
  it("accepts 10-digit numbers in any format", () => {
    expect(isValidPhone("7705551234")).toBe(true);
    expect(isValidPhone("(770) 555-1234")).toBe(true);
    expect(isValidPhone("770.555.1234")).toBe(true);
  });

  it("accepts an 11-digit number with leading 1", () => {
    expect(isValidPhone("17705551234")).toBe(true);
    expect(isValidPhone("+1 770 555 1234")).toBe(true);
  });

  it("rejects too-few or too-many digits", () => {
    expect(isValidPhone("5551234")).toBe(false);
    expect(isValidPhone("770555123")).toBe(false);
    expect(isValidPhone("277055512345")).toBe(false);
  });

  it("rejects an 11-digit number not starting with 1", () => {
    expect(isValidPhone("27705551234")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidPhone("")).toBe(false);
  });
});
