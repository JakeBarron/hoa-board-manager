import {
  canEditAll,
  canEditSection,
  isAdmin,
  canEditCRA,
  canRecordVote,
} from "./permissions";

describe("canEditAll", () => {
  it("returns true for president", () => expect(canEditAll("president")).toBe(true));
  it("returns true for officer", () => expect(canEditAll("officer")).toBe(true));
  it("returns false for member", () => expect(canEditAll("member")).toBe(false));
});

describe("canEditSection", () => {
  it("allows a member to edit their own section", () => {
    expect(canEditSection("pool", "pool", "member")).toBe(true);
  });

  it("prevents a member from editing another section", () => {
    expect(canEditSection("pool", "treasurer", "member")).toBe(false);
  });

  it("allows an officer to edit any section", () => {
    expect(canEditSection("vp", "pool", "officer")).toBe(true);
    expect(canEditSection("secretary", "treasurer", "officer")).toBe(true);
  });

  it("allows president to edit any section", () => {
    expect(canEditSection("president", "social", "president")).toBe(true);
  });
});

describe("isAdmin", () => {
  it("returns true only for president", () => {
    expect(isAdmin("president")).toBe(true);
    expect(isAdmin("officer")).toBe(false);
    expect(isAdmin("member")).toBe(false);
  });
});

describe("canEditCRA", () => {
  it("allows president and officer to edit CRA", () => {
    expect(canEditCRA("president")).toBe(true);
    expect(canEditCRA("officer")).toBe(true);
  });

  it("prevents members from editing CRA", () => {
    expect(canEditCRA("member")).toBe(false);
  });
});

describe("canRecordVote", () => {
  it("allows only the president to record votes", () => {
    expect(canRecordVote("president")).toBe(true);
    expect(canRecordVote("officer")).toBe(false);
    expect(canRecordVote("member")).toBe(false);
  });
});
