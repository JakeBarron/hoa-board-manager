"use client";

import React, { useState, useCallback, useMemo } from "react";
import type { Property, AssessmentPayment, AssessmentStatus } from "@/types/database";
import type { MapFilters } from "@/types/domain";
import { filterProperties } from "@/lib/map";
import { AssessmentEditPanel } from "./AssessmentEditPanel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const DEFAULT_FILTERS: MapFilters = { membership: "", sayor: null, lotSearch: "" };

function sayorToString(sayor: boolean | null): string {
  if (sayor === null) return "all";
  return sayor ? "true" : "false";
}

function stringToSayor(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

const STATUS_BADGE_CLASS: Record<AssessmentStatus, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
  unpaid: "bg-red-100 text-red-800",
  waived: "bg-gray-100 text-gray-600",
};

interface PropertiesViewProps {
  /** Full list of properties fetched server-side, ordered by lot_number. */
  lots: Property[];
  /** Assessment payments for the current fiscal year. Empty array if no fiscal year exists. */
  assessments: AssessmentPayment[];
  /** Whether the current user can edit assessment payment status. */
  canEditAssessments: boolean;
}

/**
 * Filterable property table with assessment payment status columns.
 * When assessments are loaded and the user has edit rights, clicking a row
 * expands an inline AssessmentEditPanel.
 */
export function PropertiesView({ lots, assessments, canEditAssessments }: PropertiesViewProps) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [statusFilter, setStatusFilter] = useState<AssessmentStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setStatusFilter("all");
  }, []);

  const assessmentByPropertyId = useMemo(
    () => new Map(assessments.map((a) => [a.property_id, a])),
    [assessments]
  );

  const hasActiveFilter =
    filters.membership !== "" || filters.sayor !== null || filters.lotSearch !== "" || statusFilter !== "all";

  const baseFilteredLots = useMemo(
    () => filterProperties(lots, filters, null),
    [lots, filters]
  );

  const filteredLots = useMemo(() => {
    if (statusFilter === "all" || assessments.length === 0) return baseFilteredLots;
    return baseFilteredLots.filter((lot) => {
      const ap = assessmentByPropertyId.get(lot.id);
      return ap?.status === statusFilter;
    });
  }, [baseFilteredLots, statusFilter, assessments.length, assessmentByPropertyId]);

  const membershipTypes = useMemo(
    () =>
      Array.from(new Set(lots.map((l) => l.membership_type).filter(Boolean))).sort() as string[],
    [lots]
  );

  const hasAssessments = assessments.length > 0;
  const colSpan = hasAssessments ? 6 : 4;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.membership === "" ? "all" : filters.membership}
          onValueChange={(v: string | null) =>
            setFilters((f) => ({ ...f, membership: v === "all" || v === null ? "" : v }))
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All membership types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All membership types</SelectItem>
            {membershipTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sayorToString(filters.sayor)}
          onValueChange={(v: string | null) =>
            setFilters((f) => ({ ...f, sayor: stringToSayor(v ?? "all") }))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="SAYOR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">SAYOR</SelectItem>
            <SelectItem value="false">Non-SAYOR</SelectItem>
          </SelectContent>
        </Select>

        {hasAssessments && (
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as AssessmentStatus | "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Input
          className="w-32"
          placeholder="Lot #"
          value={filters.lotSearch}
          onChange={(e) => setFilters((f) => ({ ...f, lotSearch: e.target.value }))}
          aria-label="Search by lot number"
        />

        <Button variant="outline" onClick={handleReset} disabled={!hasActiveFilter}>
          Show All
        </Button>
      </div>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left p-2 font-medium">Lot</th>
              <th className="text-left p-2 font-medium">Name</th>
              <th className="text-left p-2 font-medium">Address</th>
              <th className="text-left p-2 font-medium">Membership</th>
              {hasAssessments && (
                <>
                  <th className="text-left p-2 font-medium">Assessment</th>
                  <th className="text-right p-2 font-medium">Paid</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredLots.map((lot) => {
              const ap = assessmentByPropertyId.get(lot.id);
              const isExpanded = expandedId === lot.id;
              const isClickable = hasAssessments && !!ap && canEditAssessments;
              return (
                <React.Fragment key={lot.id}>
                  <tr
                    onClick={() => {
                      if (isClickable) {
                        setExpandedId(isExpanded ? null : lot.id);
                      }
                    }}
                    className={[
                      "border-b",
                      isClickable ? "cursor-pointer hover:bg-muted/40" : "",
                      isExpanded ? "bg-muted/20" : "",
                    ].join(" ")}
                  >
                    <td className="p-2">{lot.lot_number}</td>
                    <td className="p-2">{[lot.first_name, lot.last_name].filter(Boolean).join(" ")}</td>
                    <td className="p-2">{lot.street_address ?? "—"}</td>
                    <td className="p-2">{lot.membership_type ?? "—"}</td>
                    {hasAssessments && (
                      <>
                        <td className="p-2">
                          {ap ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[ap.status]}`}>
                              {ap.status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {ap && ap.amount_paid > 0
                            ? `$${(ap.amount_paid / 100).toLocaleString()}`
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                  {isExpanded && ap && (
                    <tr>
                      <td colSpan={colSpan} className="p-0">
                        <AssessmentEditPanel
                          payment={ap}
                          onClose={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredLots.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="p-6 text-center text-muted-foreground text-sm">
                  No properties match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{filteredLots.length} of {lots.length} properties shown</p>
    </div>
  );
}
