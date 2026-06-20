import {
  OPEN_STATUSES,
  isOpenStatus,
  compareProjects,
  quoteReadiness,
  sumEstimated,
  sumActual,
} from "./projects";
import type { CRAProject } from "@/types/database";

function project(p: Partial<CRAProject>): CRAProject {
  return {
    id: "x", name: "P", description: null, status: "proposed",
    estimated_cost: 0, actual_cost: null, target_date: null,
    fiscal_year_id: null, category: null, priority: null,
    created_by: "u", created_at: "", updated_at: "", ...p,
  };
}

describe("OPEN_STATUSES", () => {
  it("includes on_hold but not complete", () => {
    expect(OPEN_STATUSES).toContain("on_hold");
    expect(OPEN_STATUSES).not.toContain("complete");
  });
});

describe("isOpenStatus", () => {
  it("is false only for complete", () => {
    expect(isOpenStatus("complete")).toBe(false);
    expect(isOpenStatus("on_hold")).toBe(true);
  });
});

describe("compareProjects", () => {
  it("sorts high priority before low", () => {
    const arr = [project({ priority: "low" }), project({ priority: "high" })];
    arr.sort(compareProjects);
    expect(arr[0].priority).toBe("high");
  });
  it("sorts by target_date asc within equal priority, nulls last", () => {
    const arr = [
      project({ priority: "high", target_date: null }),
      project({ priority: "high", target_date: "2026-09-01" }),
    ];
    arr.sort(compareProjects);
    expect(arr[0].target_date).toBe("2026-09-01");
  });
  it("sinks on_hold below other open statuses of equal priority", () => {
    const arr = [
      project({ priority: "high", status: "on_hold" }),
      project({ priority: "high", status: "in_progress" }),
    ];
    arr.sort(compareProjects);
    expect(arr[0].status).toBe("in_progress");
  });
  it("sorts null priority after explicit priorities", () => {
    const arr = [project({ priority: null }), project({ priority: "low" })];
    arr.sort(compareProjects);
    expect(arr[0].priority).toBe("low");
    expect(arr[1].priority).toBeNull();
  });
});

describe("quoteReadiness", () => {
  it("is unmet below 3 and met at 3", () => {
    expect(quoteReadiness(2).met).toBe(false);
    expect(quoteReadiness(3).met).toBe(true);
  });
});

describe("sumEstimated / sumActual", () => {
  it("sums estimated cents, treating null as 0", () => {
    expect(sumEstimated([project({ estimated_cost: 1000 }), project({ estimated_cost: null })])).toBe(1000);
  });
  it("sums actual cents, treating null as 0", () => {
    expect(sumActual([project({ actual_cost: 500 }), project({ actual_cost: null })])).toBe(500);
  });
});
