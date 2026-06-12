"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveActuals } from "@/actions/treasury";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { CashBalance } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActualsFormProps {
  fiscalYearId: string;
  categories: CategoryBudgetSummary[];
  latestCashBalance: CashBalance | null;
}

/** Converts a cent integer to a display string with two decimal places. */
function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parses a dollar string (strips $ and commas) to a cent integer. Returns 0 for non-numeric input. */
function parseDollarsToCents(value: string): number {
  const n = parseFloat(value.replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const SECTION_ORDER = [
  "operating_income",
  "operating_expense",
  "reserve_income",
  "reserve_expense",
] as const;

const SECTION_LABEL: Record<string, string> = {
  operating_income: "Operating Income",
  operating_expense: "Operating Expense",
  reserve_income: "Reserve Income",
  reserve_expense: "Reserve Expense",
};

/**
 * Form for entering monthly YTD actuals per category and current cash balances.
 * Submits all data atomically via the saveActuals server action.
 * On success, navigates back to /treasury.
 *
 * @param fiscalYearId     - UUID of the active fiscal year
 * @param categories       - Budget categories with latest actuals pre-merged
 * @param latestCashBalance - Most recent cash balance row (used to pre-populate inputs)
 */
export function ActualsForm({
  fiscalYearId,
  categories,
  latestCashBalance,
}: ActualsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(today);

  // Initialize actuals inputs from latest actuals (or empty string for blank rows)
  const [actuals, setActuals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        `${c.category}:${c.account_type}`,
        c.ytd_actual > 0 ? centsToDisplay(c.ytd_actual) : "",
      ])
    )
  );

  const [operatingBalance, setOperatingBalance] = useState(
    latestCashBalance ? centsToDisplay(latestCashBalance.operating_balance) : ""
  );
  const [reserveBalance, setReserveBalance] = useState(
    latestCashBalance ? centsToDisplay(latestCashBalance.reserve_balance) : ""
  );

  /** Collects form state and dispatches saveActuals, then navigates to /treasury. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const categoryActuals = categories.map((c) => ({
      category: c.category,
      account_type: c.account_type,
      ytd_actual: parseDollarsToCents(
        actuals[`${c.category}:${c.account_type}`] ?? "0"
      ),
    }));

    startTransition(async () => {
      try {
        await saveActuals(
          fiscalYearId,
          asOfDate,
          categoryActuals,
          parseDollarsToCents(operatingBalance),
          parseDollarsToCents(reserveBalance)
        );
        router.push("/treasury");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium" htmlFor="asOfDate">
          Report as of
        </label>
        <Input
          id="asOfDate"
          type="date"
          className="w-44"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          required
        />
      </div>

      {SECTION_ORDER.map((sectionType) => {
        const sectionCats = categories.filter(
          (c) => c.account_type === sectionType
        );
        if (sectionCats.length === 0) return null;
        return (
          <div key={sectionType} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {SECTION_LABEL[sectionType]}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">Category</th>
                  <th className="text-right py-1 font-medium">Annual Budget</th>
                  <th className="text-right py-1 font-medium">Prior Entry</th>
                  <th className="text-right py-1 font-medium w-40">
                    YTD Actual
                  </th>
                </tr>
              </thead>
              <tbody>
                {sectionCats.map((cat) => {
                  const key = `${cat.category}:${cat.account_type}`;
                  return (
                    <tr key={key} className="border-b">
                      <td className="py-2">{cat.category}</td>
                      <td className="text-right py-2 text-muted-foreground">
                        ${(cat.budget_amount / 100).toLocaleString()}
                      </td>
                      <td className="text-right py-2 text-muted-foreground">
                        {cat.ytd_actual > 0
                          ? `$${(cat.ytd_actual / 100).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="py-2 pl-4">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={actuals[key] ?? ""}
                          onChange={(e) =>
                            setActuals((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          aria-label={`YTD actual for ${cat.category}`}
                          className="text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cash Balances
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="operatingBalance">
              Operating Account
            </label>
            <Input
              id="operatingBalance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={operatingBalance}
              onChange={(e) => setOperatingBalance(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="reserveBalance">
              Reserve Account
            </label>
            <Input
              id="reserveBalance"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={reserveBalance}
              onChange={(e) => setReserveBalance(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Actuals"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/treasury")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
