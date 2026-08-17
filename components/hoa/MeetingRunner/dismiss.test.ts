import { resolveDismiss } from "./dismiss";

describe("resolveDismiss", () => {
  it("refuses to dismiss a meeting that is under way", () => {
    // Escape does not fire beforeunload, so nothing else would catch this.
    expect(resolveDismiss("running")).toBe("refuse");
  });

  it("backs out of an overlay panel rather than leaving the meeting", () => {
    expect(resolveDismiss("voting")).toBe("dismissPanel");
    expect(resolveDismiss("actionItem")).toBe("dismissPanel");
    expect(resolveDismiss("adjourn")).toBe("dismissPanel");
  });

  it("closes from the pre-start wizard, where nothing live is at stake", () => {
    expect(resolveDismiss("newBusiness")).toBe("close");
    expect(resolveDismiss("attendance")).toBe("close");
    expect(resolveDismiss("callToOrder")).toBe("close");
  });

  it("closes once the meeting has adjourned", () => {
    expect(resolveDismiss("export")).toBe("close");
  });
});
