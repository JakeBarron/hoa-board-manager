import { X } from "lucide-react";
import type { Property } from "@/types/database";

/** A single placeholder lot polygon with its label. */
interface LotShape {
  lotNumber: number;
  points: string;
  labelX: number;
  labelY: number;
}

/**
 * Placeholder lot shapes — 12 rectangles arranged in two rows of 6.
 * Replace with real traced polygon coordinates once the map image is provided.
 * Each lot's `points` is a space-separated list of "x,y" SVG polygon vertices.
 */
const PLACEHOLDER_LOTS: LotShape[] = [
  { lotNumber: 1,  points: "20,30 130,30 130,110 20,110",    labelX: 75,  labelY: 75  },
  { lotNumber: 2,  points: "140,30 250,30 250,110 140,110",   labelX: 195, labelY: 75  },
  { lotNumber: 3,  points: "260,30 370,30 370,110 260,110",   labelX: 315, labelY: 75  },
  { lotNumber: 4,  points: "380,30 490,30 490,110 380,110",   labelX: 435, labelY: 75  },
  { lotNumber: 5,  points: "500,30 610,30 610,110 500,110",   labelX: 555, labelY: 75  },
  { lotNumber: 6,  points: "620,30 730,30 730,110 620,110",   labelX: 675, labelY: 75  },
  { lotNumber: 7,  points: "20,160 130,160 130,240 20,240",   labelX: 75,  labelY: 205 },
  { lotNumber: 8,  points: "140,160 250,160 250,240 140,240", labelX: 195, labelY: 205 },
  { lotNumber: 9,  points: "260,160 370,160 370,240 260,240", labelX: 315, labelY: 205 },
  { lotNumber: 10, points: "380,160 490,160 490,240 380,240", labelX: 435, labelY: 205 },
  { lotNumber: 11, points: "500,160 610,160 610,240 500,240", labelX: 555, labelY: 205 },
  { lotNumber: 12, points: "620,160 730,160 730,240 620,240", labelX: 675, labelY: 205 },
];

interface NeighborhoodMapProps {
  /** Lot number of the currently selected polygon, or null for none. */
  selectedLotId: number | null;
  /**
   * Property data for the selected lot, used to populate the InfoCard.
   * Null when no lot is selected.
   */
  selectedLot: Property | null;
  /** Called with the lot_number when a polygon is clicked. */
  onLotClick: (lotNumber: number) => void;
  /** Called when the InfoCard dismiss button is clicked. */
  onDismiss: () => void;
}

/**
 * Interactive SVG neighborhood map with clickable lot polygons.
 * Displays an InfoCard in the top-right corner when a lot is selected.
 *
 * The polygon coordinates are currently placeholders.
 * Replace PLACEHOLDER_LOTS with real coordinates traced from the
 * actual neighborhood map image once it is provided.
 */
export function NeighborhoodMap({
  selectedLotId,
  selectedLot,
  onLotClick,
  onDismiss,
}: NeighborhoodMapProps) {
  return (
    <div className="relative w-full rounded-lg border bg-card overflow-hidden">
      <svg
        viewBox="0 0 760 270"
        className="w-full"
        aria-label="Neighborhood lot map"
        role="img"
      >
        {/* Road background */}
        <rect x="0" y="0" width="760" height="270" fill="#e5e7eb" />
        <rect x="0" y="120" width="760" height="30" fill="#d1d5db" />

        {PLACEHOLDER_LOTS.map(({ lotNumber, points, labelX, labelY }) => {
          const isSelected = lotNumber === selectedLotId;
          return (
            <g
              key={lotNumber}
              onClick={() => onLotClick(lotNumber)}
              className="cursor-pointer"
              role="button"
              aria-label={`Lot ${lotNumber}`}
              aria-pressed={isSelected}
            >
              <polygon
                points={points}
                fill={isSelected ? "#bfdbfe" : "#f9fafb"}
                stroke={isSelected ? "#3b82f6" : "#9ca3af"}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-colors hover:fill-blue-50"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill={isSelected ? "#1d4ed8" : "#374151"}
                className="select-none pointer-events-none font-medium"
              >
                {lotNumber}
              </text>
            </g>
          );
        })}
      </svg>

      {/* InfoCard — appears in top-right when a lot is selected */}
      {selectedLot && (
        <div className="absolute top-3 right-3 z-10 min-w-[180px] rounded-lg border bg-card p-3 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Lot {selectedLot.lot_number}</p>
              <p className="text-sm">{selectedLot.last_name}</p>
              <p className="text-xs text-muted-foreground">{selectedLot.membership ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{selectedLot.membership_type ?? "—"}</p>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close lot info"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
