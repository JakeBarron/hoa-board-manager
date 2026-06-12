import type { BudgetLineItem, CategoryActual } from "@/types/database";
import type { CategoryBudgetSummary } from "@/types/domain";

/**
 * Returns the most recent actuals per (category, account_type) combination.
 * Assumes actuals are pre-sorted descending by as_of_date so the first hit
 * per key is the most recent.
 *
 * @param actuals - All actuals for a fiscal year, ordered desc by as_of_date
 */
export function latestActualsMap(actuals: CategoryActual[]): Map<string, CategoryActual> {
  const map = new Map<string, CategoryActual>();
  for (const a of actuals) {
    const key = `${a.category}:${a.account_type}`;
    if (!map.has(key)) map.set(key, a);
  }
  return map;
}

/**
 * Groups budget line items into CategoryBudgetSummary records, joined with
 * the latest actuals from actualsMap.
 *
 * @param items      - Budget line items for a fiscal year
 * @param actualsMap - Map from latestActualsMap()
 */
export function buildCategoryBudgets(
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
