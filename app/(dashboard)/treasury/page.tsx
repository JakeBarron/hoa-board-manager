import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CategoryBreakdown } from "@/components/hoa/CategoryBreakdown";
import type { CategoryBudgetSummary, AssessmentSummary } from "@/types/domain";
import type {
  CashBalance,
  FiscalYear,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { latestActualsMap, buildCategoryBudgets } from "@/lib/treasury/actuals";

export const metadata = { title: "Treasury — HOA Board" };

/** Formats an integer cent amount as a USD string, e.g. 14620000 → "$146,200" */
function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function TreasuryPage() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;
  const canEdit = canEditTreasury(position.role, position.name);

  // Fetch fiscal years (most recent first)
  const fyResult = await supabase
    .from("fiscal_years")
    .select("*")
    .order("start_date", { ascending: false });
  const fiscalYears = fyResult.data ?? [];
  const currentFY: FiscalYear | null = fiscalYears[0] ?? null;

  if (!currentFY) {
    return (
      <div className="space-y-6">
        <PageHeader title="Treasury" subtitle="Financial overview" />
        <SectionCard title="No fiscal year found">
          <p className="text-muted-foreground text-sm">
            {canEdit
              ? "Create a fiscal year to get started."
              : "No fiscal year has been set up yet."}
          </p>
          {canEdit && (
            <div className="mt-4">
              <Button
                render={<Link href="/treasury/budget" />}
                nativeButton={false}
              >
                Set Up Budget
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // Parallel data fetch for current fiscal year
  const [cbResult, actualsResult, itemsResult, apResult] = await Promise.all([
    supabase
      .from("cash_balances")
      .select("*")
      .eq("fiscal_year_id", currentFY.id)
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("budget_category_actuals")
      .select("*")
      .eq("fiscal_year_id", currentFY.id)
      .order("as_of_date", { ascending: false }),
    supabase
      .from("budget_line_items")
      .select("*")
      .eq("fiscal_year_id", currentFY.id),
    supabase
      .from("assessment_payments")
      .select("status, amount_due, amount_paid")
      .eq("fiscal_year_id", currentFY.id),
  ]);

  const cashBalance: CashBalance | null = cbResult.data ?? null;
  const actuals = actualsResult.data ?? [];
  const lineItems = itemsResult.data ?? [];
  const assessmentRows = apResult.data ?? [];

  const actualsMap = latestActualsMap(actuals);
  const categoryBudgets = buildCategoryBudgets(lineItems, actualsMap);

  // Income vs expense summary
  const totalBudgetIncome = categoryBudgets
    .filter((c) => c.account_type.endsWith("_income"))
    .reduce((s, c) => s + c.budget_amount, 0);
  const totalActualIncome = categoryBudgets
    .filter((c) => c.account_type.endsWith("_income"))
    .reduce((s, c) => s + c.ytd_actual, 0);
  const totalBudgetExpense = categoryBudgets
    .filter((c) => c.account_type.endsWith("_expense"))
    .reduce((s, c) => s + c.budget_amount, 0);
  const totalActualExpense = categoryBudgets
    .filter((c) => c.account_type.endsWith("_expense"))
    .reduce((s, c) => s + c.ytd_actual, 0);

  // Assessment summary
  const assessmentSummary: AssessmentSummary = {
    total: assessmentRows.length,
    paid: assessmentRows.filter((r) => r.status === "paid").length,
    partial: assessmentRows.filter((r) => r.status === "partial").length,
    unpaid: assessmentRows.filter((r) => r.status === "unpaid").length,
    waived: assessmentRows.filter((r) => r.status === "waived").length,
    total_due: assessmentRows.reduce((s, r) => s + r.amount_due, 0),
    total_paid: assessmentRows.reduce((s, r) => s + r.amount_paid, 0),
  };

  const incomeProgress =
    totalBudgetIncome > 0
      ? Math.round((totalActualIncome / totalBudgetIncome) * 100)
      : 0;
  const expenseProgress =
    totalBudgetExpense > 0
      ? Math.round((totalActualExpense / totalBudgetExpense) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Treasury — ${currentFY.label}`}
        subtitle={`${currentFY.status === "approved" ? "Budget approved" : "Budget draft"} · ${currentFY.start_date} to ${currentFY.end_date}`}
        action={
          canEdit ? (
            <Button
              render={<Link href="/treasury/actuals" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Enter Actuals
            </Button>
          ) : undefined
        }
      />

      {/* Cash on hand */}
      <SectionCard title="Cash on Hand">
        {cashBalance ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Operating</p>
              <p className="text-2xl font-semibold">
                {formatCents(cashBalance.operating_balance)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reserve</p>
              <p className="text-2xl font-semibold">
                {formatCents(cashBalance.reserve_balance)}
              </p>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              As of {cashBalance.as_of_date}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No balance entered yet.{" "}
            {canEdit && (
              <Link href="/treasury/actuals" className="underline">
                Enter one now
              </Link>
            )}
          </p>
        )}
      </SectionCard>

      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Income (YTD)">
          <p className="text-xl font-semibold">
            {formatCents(totalActualIncome)}
          </p>
          <p className="text-sm text-muted-foreground">
            of {formatCents(totalBudgetIncome)} budgeted
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{ width: `${Math.min(incomeProgress, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {incomeProgress}% collected
          </p>
        </SectionCard>

        <SectionCard title="Expenses (YTD)">
          <p className="text-xl font-semibold">
            {formatCents(totalActualExpense)}
          </p>
          <p className="text-sm text-muted-foreground">
            of {formatCents(totalBudgetExpense)} budgeted
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.min(expenseProgress, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {expenseProgress}% spent
          </p>
        </SectionCard>
      </div>

      {/* Assessments strip */}
      {assessmentSummary.total > 0 && (
        <SectionCard title="Assessments">
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <span className="font-semibold text-green-600">
                {assessmentSummary.paid}
              </span>{" "}
              paid
            </span>
            <span>
              <span className="font-semibold text-yellow-600">
                {assessmentSummary.partial}
              </span>{" "}
              partial
            </span>
            <span>
              <span className="font-semibold text-red-600">
                {assessmentSummary.unpaid}
              </span>{" "}
              unpaid
            </span>
            <span>
              <span className="font-semibold">{assessmentSummary.waived}</span>{" "}
              waived
            </span>
            <span className="ml-auto">
              {formatCents(assessmentSummary.total_paid)} collected of{" "}
              {formatCents(assessmentSummary.total_due)}
            </span>
          </div>
          <div className="mt-2">
            <Link
              href="/properties?status=unpaid"
              className="text-sm underline text-muted-foreground"
            >
              View unpaid →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Category breakdown */}
      {categoryBudgets.length > 0 && (
        <SectionCard title="Budget by Category">
          <CategoryBreakdown categories={categoryBudgets} />
        </SectionCard>
      )}
    </div>
  );
}
