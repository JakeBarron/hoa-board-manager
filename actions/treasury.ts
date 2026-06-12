"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import type { AccountType, AssessmentStatus } from "@/types/database";
import type { ParsedBudgetRow } from "@/lib/treasury/csv-parser";

/** Resolves the current user's position. Throws if unauthenticated or no position found. */
async function requirePosition() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: position } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();

  if (!position) throw new Error("Position not found");
  return { supabase, position };
}

/** Resolves position and verifies canEditTreasury. Throws if unauthorized. */
async function requireTreasuryEditor() {
  const { supabase, position } = await requirePosition();
  if (!canEditTreasury(position.role, position.name)) {
    throw new Error("Not authorized to edit treasury data");
  }
  return { supabase, position };
}

/**
 * Creates a new fiscal year in draft status.
 * Returns the new fiscal year's id.
 *
 * @param label                    - e.g. "FY26"
 * @param startDate                - ISO date "2025-04-01"
 * @param endDate                  - ISO date "2026-03-31"
 * @param defaultAssessmentAmount  - Annual assessment in cents
 */
export async function createFiscalYear(
  label: string,
  startDate: string,
  endDate: string,
  defaultAssessmentAmount: number
): Promise<string> {
  const { supabase } = await requireTreasuryEditor();

  const { data, error } = await supabase
    .from("fiscal_years")
    .insert({ label, start_date: startDate, end_date: endDate, default_assessment_amount: defaultAssessmentAmount })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/treasury", "layout");
  return data.id;
}

/**
 * Replaces all budget line items and monthly amounts for a fiscal year.
 * The fiscal year must be in 'draft' status. Existing line items are deleted
 * first (cascade removes monthly amounts), then new ones are inserted.
 *
 * @param fiscalYearId - UUID of the fiscal year to import into
 * @param rows         - Parsed rows from parseBudgetCSV()
 */
export async function importBudget(
  fiscalYearId: string,
  rows: ParsedBudgetRow[]
): Promise<void> {
  const { supabase } = await requireTreasuryEditor();

  // Verify draft status
  const { data: fy } = await supabase
    .from("fiscal_years")
    .select("status")
    .eq("id", fiscalYearId)
    .single();
  if (fy?.status !== "draft") throw new Error("Cannot import: budget is already approved.");

  // Delete existing line items (monthly amounts cascade)
  const { error: delError } = await supabase
    .from("budget_line_items")
    .delete()
    .eq("fiscal_year_id", fiscalYearId);
  if (delError) throw new Error(delError.message);

  if (rows.length === 0) {
    revalidatePath("/treasury", "layout");
    return;
  }

  // Insert line items
  const lineItemInserts = rows.map((r) => ({
    fiscal_year_id: fiscalYearId,
    gl_code: r.gl_code,
    description: r.description,
    category: r.category,
    account_type: r.account_type,
    budget_amount: r.budget_amount,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("budget_line_items")
    .insert(lineItemInserts)
    .select("id, gl_code");
  if (insertError) throw new Error(insertError.message);

  // Build a lookup map for O(1) access and to surface any duplicate gl_codes
  const rowsByGlCode = new Map(rows.map((r) => [r.gl_code, r]));

  // Insert monthly amounts
  const monthlyInserts = inserted.flatMap((item) => {
    const row = rowsByGlCode.get(item.gl_code);
    if (!row) return [];
    return row.monthly_amounts.map((m) => ({
      budget_line_item_id: item.id,
      month_start: m.month_start,
      amount: m.amount,
    }));
  });

  const { error: monthlyError } = await supabase
    .from("budget_monthly_amounts")
    .insert(monthlyInserts);
  if (monthlyError) throw new Error(monthlyError.message);

  revalidatePath("/treasury", "layout");
}

/**
 * Sets fiscal year status to 'approved', locking the budget from re-import.
 * President only.
 *
 * @param fiscalYearId - UUID of the fiscal year to approve
 */
export async function approveBudget(fiscalYearId: string): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();
  if (position.role !== "president") throw new Error("Only the president can approve budgets.");

  const { data: fy } = await supabase
    .from("fiscal_years")
    .select("status")
    .eq("id", fiscalYearId)
    .single();
  if (fy?.status === "approved") throw new Error("Budget is already approved.");

  const { error } = await supabase
    .from("fiscal_years")
    .update({ status: "approved" })
    .eq("id", fiscalYearId);
  if (error) throw new Error(error.message);
  revalidatePath("/treasury", "layout");
}

/**
 * Upserts YTD category actuals and appends a cash balance snapshot for a given date.
 * Category actuals upsert on (fiscal_year_id, category, account_type, as_of_date) so
 * re-submitting the same date overwrites the previous actuals entry.
 * Cash balances are append-only — each submission creates a new point-in-time snapshot
 * even if the same as_of_date is submitted twice.
 *
 * @param fiscalYearId     - UUID of the active fiscal year
 * @param asOfDate         - ISO date the actuals are through (e.g. "2025-11-30")
 * @param categoryActuals  - Array of { category, account_type, ytd_actual (cents) }
 * @param operatingBalance - Operating account cash in cents
 * @param reserveBalance   - Reserve account cash in cents
 */
export async function saveActuals(
  fiscalYearId: string,
  asOfDate: string,
  categoryActuals: { category: string; account_type: AccountType; ytd_actual: number }[],
  operatingBalance: number,
  reserveBalance: number
): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();

  const upserts = categoryActuals.map((ca) => ({
    fiscal_year_id: fiscalYearId,
    category: ca.category,
    account_type: ca.account_type,
    as_of_date: asOfDate,
    ytd_actual: ca.ytd_actual,
    entered_by_position_id: position.id,
    entered_at: new Date().toISOString(),
  }));

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("budget_category_actuals")
      .upsert(upserts, { onConflict: "fiscal_year_id,category,account_type,as_of_date" });
    if (error) throw new Error(error.message);
  }

  const { error: cbError } = await supabase
    .from("cash_balances")
    .insert({
      fiscal_year_id: fiscalYearId,
      as_of_date: asOfDate,
      operating_balance: operatingBalance,
      reserve_balance: reserveBalance,
      entered_by_position_id: position.id,
    });
  if (cbError) throw new Error(cbError.message);

  revalidatePath("/treasury", "layout");
}

/**
 * Creates assessment_payments rows for all active properties using the
 * fiscal year's default_assessment_amount. Safe to re-run (upsert on conflict).
 *
 * @param fiscalYearId - UUID of the fiscal year to initialize assessments for
 */
export async function initializeAssessments(fiscalYearId: string): Promise<void> {
  const { supabase } = await requireTreasuryEditor();

  const [fyResult, propsResult] = await Promise.all([
    supabase.from("fiscal_years").select("default_assessment_amount").eq("id", fiscalYearId).single(),
    supabase.from("properties").select("id"),
  ]);

  if (fyResult.error) throw new Error(fyResult.error.message);
  if (propsResult.error) throw new Error(propsResult.error.message);

  const amountDue = fyResult.data.default_assessment_amount;
  const inserts = (propsResult.data ?? []).map((p) => ({
    property_id: p.id,
    fiscal_year_id: fiscalYearId,
    amount_due: amountDue,
  }));

  const { error } = await supabase
    .from("assessment_payments")
    .upsert(inserts, { onConflict: "property_id,fiscal_year_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/treasury");
}

/**
 * Updates a single assessment payment record.
 *
 * @param id               - UUID of the assessment_payment row
 * @param status           - New payment status
 * @param amountPaid       - Amount paid in cents
 * @param paymentReference - Check number, online payment ID, etc.
 * @param paidAt           - ISO date of payment
 * @param notes            - Free-text notes
 */
export async function updateAssessmentPayment(
  id: string,
  status: AssessmentStatus,
  amountPaid: number,
  paymentReference: string | null,
  paidAt: string | null,
  notes: string | null
): Promise<void> {
  const { supabase, position } = await requireTreasuryEditor();

  const { error } = await supabase
    .from("assessment_payments")
    .update({
      status,
      amount_paid: amountPaid,
      payment_reference: paymentReference,
      paid_at: paidAt,
      notes,
      entered_by_position_id: position.id,
      entered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/properties");
  revalidatePath("/treasury");
}
