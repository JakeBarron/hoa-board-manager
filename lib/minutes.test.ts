import { hasMinutesContent } from "./minutes";

describe("hasMinutesContent", () => {
  it("returns false for null and undefined", () => {
    expect(hasMinutesContent(null)).toBe(false);
    expect(hasMinutesContent(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasMinutesContent("")).toBe(false);
  });

  it("returns false for Tiptap's empty document", () => {
    expect(hasMinutesContent("<p></p>")).toBe(false);
  });

  it("returns false for markup with no text between the tags", () => {
    expect(hasMinutesContent("<h2></h2><p></p><ul><li></li></ul>")).toBe(false);
  });

  it("returns false for whitespace and &nbsp; only", () => {
    expect(hasMinutesContent("<p>   </p>")).toBe(false);
    expect(hasMinutesContent("<p>&nbsp;</p>")).toBe(false);
    expect(hasMinutesContent("<p>&NBSP;</p>")).toBe(false);
  });

  it("returns true when a paragraph has text", () => {
    expect(hasMinutesContent("<p>Meeting called to order.</p>")).toBe(true);
  });

  it("returns true when only a heading carries the text", () => {
    expect(hasMinutesContent("<h2>Old Business</h2><p></p>")).toBe(true);
  });

  it("returns true for text nested in list items", () => {
    expect(hasMinutesContent("<ul><li>Approve prior minutes</li></ul>")).toBe(
      true
    );
  });
});
