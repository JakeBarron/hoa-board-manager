import type { Property } from "@/types/database";
import type { MapFilters } from "@/types/domain";

/**
 * Returns the subset of `lots` that match the current filter state.
 *
 * When `selectedLotId` is non-null it takes priority — returns exactly
 * the one matching lot regardless of any other filter values.
 *
 * @param lots - Full list of properties fetched server-side
 * @param filters - Active filter values from MapView state
 * @param selectedLotId - Lot number of the currently selected polygon, or null
 */
export function filterProperties(
  lots: Property[],
  filters: MapFilters,
  selectedLotId: number | null
): Property[] {
  if (selectedLotId !== null) {
    return lots.filter((l) => l.lot_number === selectedLotId);
  }
  return lots.filter((l) => {
    if (filters.membership && l.membership_type !== filters.membership) return false;
    if (filters.sayor !== null && l.sayor !== filters.sayor) return false;
    if (filters.lotSearch && !String(l.lot_number).includes(filters.lotSearch)) return false;
    return true;
  });
}
