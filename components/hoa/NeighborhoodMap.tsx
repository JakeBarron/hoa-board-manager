"use client";

import { useRef, useState, useCallback, useEffect, type WheelEvent, type MouseEvent } from "react";
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { Property } from "@/types/database";
import { LOT_POLYGONS } from "@/lib/map-polygons";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

type ColorEntry = { fill: string; stroke: string; text: string };

// Keyed by "membership|membershipType" (membershipType is "" when null)
const MEMBERSHIP_COLORS: Record<string, ColorEntry> = {
  "Mandatory|Recreation":                  { fill: "#ffffff", stroke: "#d1d5db", text: "#374151" },
  "Non-Mandatory|Civic":                   { fill: "#fef08a", stroke: "#fde047", text: "#713f12" },
  "Non-Mandatory|Recreation Billable":     { fill: "#ddd6fe", stroke: "#c4b5fd", text: "#4c1d95" },
  "Non-Mandatory|Non Participating":       { fill: "#bae6fd", stroke: "#7dd3fc", text: "#0c4a6e" },
  "Non-Covenant|Non-Participating":        { fill: "#fbcfe8", stroke: "#f9a8d4", text: "#831843" },
  "Non-Covenant|Civic":                    { fill: "#fed7aa", stroke: "#fdba74", text: "#7c2d12" },
  "Non-Covenant|":                         { fill: "#f1f5f9", stroke: "#e2e8f0", text: "#475569" },
  "Non-ESL Resident|Recreation Billable":  { fill: "#fecaca", stroke: "#fca5a5", text: "#7f1d1d" },
};
const DEFAULT_COLOR: ColorEntry = { fill: "#f3f4f6", stroke: "#e5e7eb", text: "#6b7280" };

function membershipColor(membership: string | null, membershipType: string | null): ColorEntry {
  return MEMBERSHIP_COLORS[`${membership ?? ""}|${membershipType ?? ""}`] ?? DEFAULT_COLOR;
}

const LEGEND_ITEMS: Array<{ label: string } & ColorEntry> = [
  { label: "Mandatory",                        ...MEMBERSHIP_COLORS["Mandatory|Recreation"] },
  { label: "Non-Mandatory — Civic",            ...MEMBERSHIP_COLORS["Non-Mandatory|Civic"] },
  { label: "Non-Mandatory — Rec. Billable",    ...MEMBERSHIP_COLORS["Non-Mandatory|Recreation Billable"] },
  { label: "Non-Mandatory — Non Participating",...MEMBERSHIP_COLORS["Non-Mandatory|Non Participating"] },
  { label: "Non-Covenant — Non-Participating", ...MEMBERSHIP_COLORS["Non-Covenant|Non-Participating"] },
  { label: "Non-Covenant — Civic",             ...MEMBERSHIP_COLORS["Non-Covenant|Civic"] },
  { label: "Non-Covenant",                     ...MEMBERSHIP_COLORS["Non-Covenant|"] },
  { label: "Non-ESL Resident",                 ...MEMBERSHIP_COLORS["Non-ESL Resident|Recreation Billable"] },
];

// ---------------------------------------------------------------------------
// Zoom / pan hook
// ---------------------------------------------------------------------------

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.25;
const INITIAL = { x: 0, y: 0, scale: 1 };

type Transform = { x: number; y: number; scale: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useZoomPan() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>(INITIAL);
  const [showHint, setShowHint] = useState(false);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const zoom = useCallback((delta: number, originX: number, originY: number) => {
    setTransform((prev) => {
      const newScale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        x: originX - (originX - prev.x) * ratio,
        y: originY - (originY - prev.y) * ratio,
      };
    });
  }, []);

  // Attach a non-passive wheel listener so preventDefault works for Ctrl+scroll.
  // React's synthetic onWheel is passive in some environments and can't prevent default.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // Plain scroll — show hint and let the page scroll normally
        setShowHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setShowHint(false), 1500);
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const originX = e.clientX - rect.left;
      const originY = e.clientY - rect.top;
      setTransform((prev) => {
        const newScale = clamp(prev.scale + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), MIN_SCALE, MAX_SCALE);
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          x: originX - (originX - prev.x) * ratio,
          y: originY - (originY - prev.y) * ratio,
        };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onWheel = useCallback((_e: WheelEvent<HTMLDivElement>) => {
    // Handled by the native listener above
  }, []);

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // Only pan on left-click on the background (not on lot elements)
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onMouseLeave = useCallback(() => { dragging.current = false; }, []);

  const zoomIn = useCallback(() => {
    const rect = containerRef.current!.getBoundingClientRect();
    zoom(ZOOM_STEP, rect.width / 2, rect.height / 2);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const rect = containerRef.current!.getBoundingClientRect();
    zoom(-ZOOM_STEP, rect.width / 2, rect.height / 2);
  }, [zoom]);

  const reset = useCallback(() => setTransform(INITIAL), []);

  return {
    containerRef,
    transform,
    showHint,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    zoomIn,
    zoomOut,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NeighborhoodMapProps {
  selectedLotId: number | null;
  selectedLot: Property | null;
  onLotClick: (lotNumber: number) => void;
  onDismiss: () => void;
}

/**
 * Interactive SVG neighborhood map with scroll-to-zoom and drag-to-pan.
 * Polygon data is generated by supabase/generate-map-polygons.ts.
 * Run `pnpm generate-map` to regenerate after editing the Inkscape SVG.
 */
export function NeighborhoodMap({
  selectedLotId,
  selectedLot,
  onLotClick,
  onDismiss,
}: NeighborhoodMapProps) {
  const { containerRef, transform, showHint, onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, zoomIn, zoomOut, reset } =
    useZoomPan();

  return (
    <div className="space-y-2">
      {/* Map container */}
      <div className="relative w-full rounded-lg border bg-card overflow-hidden" style={{ height: "480px" }}>
        {/* Zoom controls */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {[
            { icon: ZoomIn, action: zoomIn, label: "Zoom in" },
            { icon: ZoomOut, action: zoomOut, label: "Zoom out" },
            { icon: Maximize2, action: reset, label: "Reset zoom" },
          ].map(({ icon: Icon, action, label }) => (
            <button
              key={label}
              onClick={action}
              aria-label={label}
              className="flex size-7 items-center justify-center rounded border bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        {/* Pannable / zoomable viewport */}
        <div
          ref={containerRef}
          className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          <svg
            viewBox="0 0 1117 845"
            width="1117"
            height="845"
            aria-label="Neighborhood lot map"
            role="img"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              transition: "none",
            }}
          >
            <rect width="1117" height="845" fill="#f1f5f9" />

            {LOT_POLYGONS.map((lot, i) => {
              if (lot.lotNumber === null) {
                return (
                  <polygon
                    key={`nonlot-${i}`}
                    points={lot.points}
                    fill="#e2e8f0"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                );
              }

              const isSelected = lot.lotNumber === selectedLotId;
              const { fill, stroke, text } = membershipColor(lot.membership, lot.membershipType);
              return (
                <g
                  key={lot.lotNumber}
                  onClick={() => onLotClick(lot.lotNumber!)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Lot ${lot.lotNumber}`}
                  aria-pressed={isSelected}
                >
                  <polygon
                    points={lot.points}
                    fill={isSelected ? "#eff6ff" : fill}
                    stroke={isSelected ? "#3b82f6" : stroke}
                    strokeWidth={isSelected ? 2 : 1}
                    className="transition-colors hover:brightness-95"
                  />
                  <text
                    x={lot.labelX}
                    y={lot.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="7"
                    fill={isSelected ? "#1d4ed8" : text}
                    className="select-none pointer-events-none font-medium"
                  >
                    {lot.lotNumber}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Ctrl+scroll hint */}
        {showHint && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-md bg-black/60 px-3 py-2 text-xs text-white">
              Use Ctrl+scroll to zoom
            </div>
          </div>
        )}

        {/* InfoCard */}
        {selectedLot && (
          <div className="absolute top-3 right-3 z-10 min-w-[180px] rounded-lg border bg-card p-3 shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Lot {selectedLot.lot_number}</p>
                <p className="text-sm">{selectedLot.last_name}</p>
                <p className="text-xs text-muted-foreground">{selectedLot.street_address ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{selectedLot.membership ?? "—"}</p>
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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {LEGEND_ITEMS.map(({ label, fill, stroke }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-3 rounded-sm border" style={{ background: fill, borderColor: stroke }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
