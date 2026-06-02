"use client";

import { useState, useCallback, useMemo } from "react";
import type { Property } from "@/types/database";
import { NeighborhoodMap } from "./NeighborhoodMap";

interface MapViewProps {
  /** Full list of properties fetched server-side, used to populate the InfoCard. */
  lots: Property[];
}

/**
 * Interactive neighborhood map with lot selection state.
 * Clicking a polygon shows an InfoCard with the lot's property details.
 */
export function MapView({ lots }: MapViewProps) {
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);

  const handleLotClick = useCallback((lotNumber: number) => {
    setSelectedLotId((prev) => (prev === lotNumber ? null : lotNumber));
  }, []);

  const handleDismiss = useCallback(() => setSelectedLotId(null), []);

  const selectedLot = useMemo(
    () => (selectedLotId !== null ? (lots.find((l) => l.lot_number === selectedLotId) ?? null) : null),
    [lots, selectedLotId]
  );

  return (
    <NeighborhoodMap
      selectedLotId={selectedLotId}
      selectedLot={selectedLot}
      onLotClick={handleLotClick}
      onDismiss={handleDismiss}
    />
  );
}
