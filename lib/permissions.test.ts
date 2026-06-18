import {
  canEditAll,
  canEditSection,
  isAdmin,
  canEditCRA,
  canRecordVote,
  isChair,
  canEditTreasury,
} from "./permissions";

describe("canEditAll", () => {
  it("returns true for president", () => expect(canEditAll("president")).toBe(true));
  it("returns true for officer", () => expect(canEditAll("officer")).toBe(true));
  it("returns false for member", () => expect(canEditAll("member")).toBe(false));
  it("returns false for chair", () => expect(canEditAll("chair")).toBe(false));
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
  it("returns false for chair", () => expect(isAdmin("chair")).toBe(false));
});

describe("canEditCRA", () => {
  it("allows president and officer to edit CRA", () => {
    expect(canEditCRA("president", "president")).toBe(true);
    expect(canEditCRA("officer", "vp")).toBe(true);
  });

  it("allows the CRA chair position regardless of chair role", () => {
    expect(canEditCRA("chair", "cra")).toBe(true);
  });

  it("prevents members from editing CRA", () => {
    expect(canEditCRA("member", "pool")).toBe(false);
  });

  it("prevents non-CRA chairs from editing CRA", () => {
    expect(canEditCRA("chair", "architecture")).toBe(false);
  });
});

describe("canRecordVote", () => {
  it("allows only the president to record votes", () => {
    expect(canRecordVote("president")).toBe(true);
    expect(canRecordVote("officer")).toBe(false);
    expect(canRecordVote("member")).toBe(false);
  });
  it("returns false for chair", () => expect(canRecordVote("chair")).toBe(false));
});

describe("isChair", () => {
  it("returns true for chair role", () => expect(isChair("chair")).toBe(true));
  it("returns false for president", () => expect(isChair("president")).toBe(false));
  it("returns false for officer", () => expect(isChair("officer")).toBe(false));
  it("returns false for member", () => expect(isChair("member")).toBe(false));
});

describe("canEditTreasury", () => {
  it("returns true for president", () => {
    expect(canEditTreasury("president", "president")).toBe(true);
  });

  it("returns true for officer role (VP, secretary)", () => {
    expect(canEditTreasury("officer", "vp")).toBe(true);
    expect(canEditTreasury("officer", "secretary")).toBe(true);
  });

  it("returns true for the treasurer position regardless of role", () => {
    expect(canEditTreasury("member", "treasurer")).toBe(true);
  });

  it("returns false for non-treasurer members", () => {
    expect(canEditTreasury("member", "pool")).toBe(false);
    expect(canEditTreasury("member", "social")).toBe(false);
  });

  it("returns false for committee chairs", () => {
    expect(canEditTreasury("chair", "architecture")).toBe(false);
  });
});
