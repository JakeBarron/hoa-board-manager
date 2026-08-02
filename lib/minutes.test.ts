import { hasMinutesContent, toMinutesArchiveRows } from "./minutes";

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

describe("toMinutesArchiveRows", () => {
  const meeting = (
    id: string,
    meeting_date: string,
    minutes_content: string | null
  ) => ({ id, meeting_date, minutes_content });

  it("returns an empty list for no meetings", () => {
    expect(toMinutesArchiveRows([])).toEqual([]);
  });

  it("flags a meeting with a minutes body as having minutes", () => {
    const rows = toMinutesArchiveRows([
      meeting("m1", "2026-07-21", "<p>Called to order.</p>"),
    ]);
    expect(rows).toEqual([
      { id: "m1", meetingDate: "2026-07-21", hasMinutes: true },
    ]);
  });

  it("still lists a meeting that adjourned without minutes, flagged false", () => {
    const rows = toMinutesArchiveRows([meeting("m2", "2026-06-16", null)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hasMinutes).toBe(false);
  });

  it("treats an empty Tiptap document as missing minutes", () => {
    const rows = toMinutesArchiveRows([meeting("m3", "2026-06-02", "<p></p>")]);
    expect(rows[0].hasMinutes).toBe(false);
  });

  it("preserves the caller's ordering and lists every meeting", () => {
    const rows = toMinutesArchiveRows([
      meeting("m1", "2026-07-21", "<p>Notes</p>"),
      meeting("m2", "2026-06-16", null),
      meeting("m3", "2026-06-02", "<p>More notes</p>"),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["m1", "m2", "m3"]);
    expect(rows.map((r) => r.hasMinutes)).toEqual([true, false, true]);
  });
});
