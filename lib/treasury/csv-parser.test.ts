import { parseBudgetCSV } from "./csv-parser";
import type { ParsedBudgetRow } from "./csv-parser";

const FISCAL_YEAR_START = "2025-04-01";

// Minimal valid CSV with one operating income row and one reserve expense row
const SAMPLE_CSV = `East Spring Lake FY26 Budget

GL Code,Account Description,2026 Budget,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Jan,Feb,Mar
Operating Accounts
Income Accounts
G&A
40-4000-00,Member Assessment,"$146,200","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,183","$12,192"
Expense Accounts
G&A
50-5000-00,Management Fee,"$46,800","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900","$3,900"
Reserve Accounts
Expense Accounts
Replacement Fund
80-8000-00,Pool Replacement,"$10,000","$833","$833","$833","$833","$833","$833","$833","$833","$833","$833","$833","$837"
`;

describe("parseBudgetCSV", () => {
  it("parses operating income rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00");
    expect(row).toBeDefined();
    expect(row!.description).toBe("Member Assessment");
    expect(row!.category).toBe("G&A");
    expect(row!.account_type).toBe("operating_income");
    expect(row!.budget_amount).toBe(14620000); // $146,200 in cents
  });

  it("parses operating expense rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "50-5000-00");
    expect(row!.account_type).toBe("operating_expense");
    expect(row!.budget_amount).toBe(4680000); // $46,800 in cents
  });

  it("parses reserve expense rows correctly", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "80-8000-00");
    expect(row!.account_type).toBe("reserve_expense");
    expect(row!.category).toBe("Replacement Fund");
  });

  it("generates correct month_start dates for fiscal year", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00")!;
    expect(row.monthly_amounts).toHaveLength(12);
    expect(row.monthly_amounts[0].month_start).toBe("2025-04-01");
    expect(row.monthly_amounts[11].month_start).toBe("2026-03-01");
  });

  it("converts monthly amounts to cents", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-4000-00")!;
    expect(row.monthly_amounts[0].amount).toBe(1218300); // $12,183 in cents
  });

  it("returns no errors for valid CSV", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it("returns an error if no header row is found", () => {
    const result = parseBudgetCSV("GL Code,Description\n40-4000-00,Member Assessment", FISCAL_YEAR_START);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/header/i);
  });

  it("skips rows without a valid GL code", () => {
    const result = parseBudgetCSV(SAMPLE_CSV, FISCAL_YEAR_START);
    const nonGl = result.rows.filter((r) => !/^\d{2}-\d{4}-\d{2}$/.test(r.gl_code));
    expect(nonGl).toHaveLength(0);
  });

  it("handles missing monthly amount cells as 0", () => {
    const csv = `
GL Code,Account Description,2026 Budget,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Jan,Feb,Mar
Operating Accounts
Income Accounts
Misc
40-9999-00,Misc Income,$1200,$100
`;
    const result = parseBudgetCSV(csv, FISCAL_YEAR_START);
    const row = result.rows.find((r) => r.gl_code === "40-9999-00")!;
    expect(row.monthly_amounts[1].amount).toBe(0);
  });
});
