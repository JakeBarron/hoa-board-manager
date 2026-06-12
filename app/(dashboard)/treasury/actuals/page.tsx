import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { ActualsForm } from "@/components/hoa/ActualsForm";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { CategoryActual, BudgetLineItem } from "@/types/database";

export const metadata = { title: "Enter Actuals — Treasury" };

/**
 * Builds a map of the latest CategoryActual per (category, account_type) key.
 * The actuals array must be pre-sorted descending by as_of_date so the first
 * occurrence of each key is the most recent entry.
 *
 * @param actuals - All actuals for the fiscal year, ordered newest-first
 * @returns Map keyed by "category:account_type" → most recent CategoryActual row
 */
function latestActualsMap(actuals: CategoryActual[]): Map<string, CategoryActual> {
  const map = new Map<string, CategoryActual>();
  for (const a of actuals) {
    const key = `${a.category}:${a.account_type}`;
    if (!map.has(key)) map.set(key, a);
  }
  return map;
}

/**
 * Groups budget line items by (category, account_type) and merges the latest actual.
 * budget_amount is summed across all line items in the group (annual total in cents).
 *
 * @param items      - All budget_line_items rows for the fiscal year
 * @param actualsMap - Result of latestActualsMap()
 * @returns One CategoryBudgetSummary per (category, account_type) pair
 */
function buildCategoryBudgets(
  items: BudgetLineItem[],
  actualsMap: Map<string, CategoryActual>
): CategoryBudgetSummary[] {
  const groups = new Map<string, CategoryBudgetSummary>();
  for (const item of items) {
    const key = `${item.category}:${item.account_type}`;
    if (!groups.has(key)) {
      const actual = actualsMap.get(key);
      groups.set(key, {
        category: item.category,
        account_type: item.account_type,
        budget_amount: 0,
        ytd_actual: actual?.ytd_actual ?? 0,
        as_of_date: actual?.as_of_date ?? null,
        line_items: [],
      });
    }
    const g = groups.get(key)!;
    g.budget_amount += item.budget_amount;
    g.line_items.push(item);
  }
  return Array.from(groups.values());
}

/**
 * Treasury actuals entry page.
 * Redirects to /treasury if no fiscal year exists or if the user cannot edit treasury data.
 * Fetches the current fiscal year's budget line items and latest actuals, then renders ActualsForm.
 */
export default async function ActualsPage() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");

  if (
    !canEditTreasury(positionResult.data.role, positionResult.data.name)
  ) {
    redirect("/treasury");
  }

  // Get current (most recent) fiscal year
  const fyResult = await supabase
    .from("fiscal_years")
    .select("id, label")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fyResult.data) redirect("/treasury");
  const fy = fyResult.data;

  const [itemsResult, actualsResult, cbResult] = await Promise.all([
    supabase.from("budget_line_items").select("*").eq("fiscal_year_id", fy.id),
    supabase
      .from("budget_category_actuals")
      .select("*")
      .eq("fiscal_year_id", fy.id)
      .order("as_of_date", { ascending: false }),
    supabase
      .from("cash_balances")
      .select("*")
      .eq("fiscal_year_id", fy.id)
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const actualsMap = latestActualsMap(actualsResult.data ?? []);
  const categories = buildCategoryBudgets(itemsResult.data ?? [], actualsMap);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Enter Actuals — ${fy.label}`}
        subtitle="YTD figures from your Homeside monthly report"
      />
      <SectionCard title="Monthly Entry">
        <ActualsForm
          fiscalYearId={fy.id}
          categories={categories}
          latestCashBalance={cbResult.data ?? null}
        />
      </SectionCard>
    </div>
  );
}
