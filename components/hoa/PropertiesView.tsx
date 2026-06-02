"use client";

import { useState, useCallback, useMemo } from "react";
import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";
import { filterProperties } from "@/lib/map";
import { PropertyTable } from "./PropertyTable";
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

interface PropertiesViewProps {
  /** Full list of properties fetched server-side, ordered by lot_number. */
  lots: Property[];
}

/**
 * Filterable property table — membership type, SAYOR, and lot # search.
 * No map integration; lives at /properties.
 */
export function PropertiesView({ lots }: PropertiesViewProps) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);

  const handleReset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const hasActiveFilter =
    filters.membership !== "" || filters.sayor !== null || filters.lotSearch !== "";

  const filteredLots = useMemo(
    () => filterProperties(lots, filters, null),
    [lots, filters]
  );

  const membershipTypes = useMemo(
    () =>
      Array.from(new Set(lots.map((l) => l.membership_type).filter(Boolean))).sort() as string[],
    [lots]
  );

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

      <PropertyTable lots={filteredLots} />
    </div>
  );
}
