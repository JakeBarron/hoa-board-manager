"use client";

import React, { useState } from "react";
import type { CategoryBudgetSummary } from "@/types/domain";
import type { BudgetLineItem } from "@/types/database";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function accountTypeLabel(type: string): string {
  switch (type) {
    case "operating_income":
      return "Operating Income";
    case "operating_expense":
      return "Operating Expense";
    case "reserve_income":
      return "Reserve Income";
    case "reserve_expense":
      return "Reserve Expense";
    default:
      return type;
  }
}

interface CategoryBreakdownProps {
  categories: CategoryBudgetSummary[];
}

/**
 * Expandable table of budget categories with YTD actuals and GL line items.
 * Click a row to expand and see individual GL codes.
 *
 * @param categories - Array of CategoryBudgetSummary records to render, grouped by account_type.
 */
export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Group by account_type for section headers
  const sections = [
    "operating_income",
    "operating_expense",
    "reserve_income",
    "reserve_expense",
  ] as const;

  return (
    <div className="space-y-6">
      {sections.map((sectionType) => {
        const sectionCats = categories.filter(
          (c) => c.account_type === sectionType
        );
        if (sectionCats.length === 0) return null;
        const sectionBudget = sectionCats.reduce(
          (s, c) => s + c.budget_amount,
          0
        );
        const sectionActual = sectionCats.reduce(
          (s, c) => s + c.ytd_actual,
          0
        );

        return (
          <div key={sectionType}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {accountTypeLabel(sectionType)}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">Category</th>
                  <th className="text-right py-1 font-medium">Budget</th>
                  <th className="text-right py-1 font-medium">YTD Actual</th>
                  <th className="text-right py-1 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {sectionCats.map((cat) => {
                  const key = `${cat.category}:${cat.account_type}`;
                  const remaining = cat.budget_amount - cat.ytd_actual;
                  const isOpen = expanded.has(key);
                  return (
                    <React.Fragment key={key}>
                      <tr
                        onClick={() => toggle(key)}
                        className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2">
                          <span className="mr-1 text-muted-foreground">
                            {isOpen ? "▾" : "▸"}
                          </span>
                          {cat.category}
                        </td>
                        <td className="text-right py-2">
                          {formatCents(cat.budget_amount)}
                        </td>
                        <td className="text-right py-2">
                          {cat.ytd_actual > 0
                            ? formatCents(cat.ytd_actual)
                            : "—"}
                        </td>
                        <td
                          className={`text-right py-2 ${remaining < 0 ? "text-red-600" : ""}`}
                        >
                          {formatCents(remaining)}
                        </td>
                      </tr>
                      {isOpen &&
                        cat.line_items.map((item: BudgetLineItem) => (
                          <tr
                            key={item.id}
                            className="border-b bg-muted/20 text-xs text-muted-foreground"
                          >
                            <td className="py-1 pl-6">
                              <span className="font-mono">{item.gl_code}</span>{" "}
                              — {item.description}
                            </td>
                            <td className="text-right py-1">
                              {formatCents(item.budget_amount)}
                            </td>
                            <td className="text-right py-1">—</td>
                            <td className="text-right py-1">
                              {formatCents(item.budget_amount)}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
                <tr className="font-semibold text-xs border-t-2">
                  <td className="py-2">Total</td>
                  <td className="text-right py-2">
                    {formatCents(sectionBudget)}
                  </td>
                  <td className="text-right py-2">
                    {sectionActual > 0 ? formatCents(sectionActual) : "—"}
                  </td>
                  <td className="text-right py-2">
                    {formatCents(sectionBudget - sectionActual)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
