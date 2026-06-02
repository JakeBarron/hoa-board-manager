/**
 * Parses the Inkscape-traced neighborhood SVG, matches each polygon to a
 * properties row via lot number label, normalizes coordinates to a 1117×845
 * viewBox, and writes lib/map-polygons.ts.
 *
 * Usage:
 *   pnpm generate-map [/path/to/lots.svg] [--force]
 *
 * --force  Write the output file even if there are unresolved mismatches
 *          (unmatched polygons are kept as inert non-lot shapes).
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const SVG_PATH =
  process.argv.find((a) => a.endsWith(".svg")) ??
  path.join(process.cwd(), "../Desktop/lots.svg");
const OUTPUT_PATH = path.join(process.cwd(), "lib/map-polygons.ts");
const FORCE = process.argv.includes("--force");
const TARGET_W = 1117;
const TARGET_H = 845;
const PADDING = 16;

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// SVG parsing
// ---------------------------------------------------------------------------

interface RawLot {
  label: string;
  d: string;
}

/** Extracts all labeled path elements from the lots layer of the SVG. */
function extractRawLots(svgContent: string): RawLot[] {
  const layerMatch = svgContent.match(/<g[^>]*id="layer1"[^>]*>([\s\S]*?)<\/g>/);
  if (!layerMatch) throw new Error('Could not find lots layer (id="layer1") in SVG');

  const lots: RawLot[] = [];
  for (const match of layerMatch[1].matchAll(/<path\s+([\s\S]*?)\/>/g)) {
    const attrs = match[1];
    const labelMatch = attrs.match(/inkscape:label="([^"]+)"/);
    const dMatch = attrs.match(/\bd="([^"]+)"/);
    if (labelMatch && dMatch) {
      lots.push({ label: labelMatch[1], d: dMatch[1] });
    }
  }

  return lots;
}

// ---------------------------------------------------------------------------
// Path → absolute coordinates (straight-line commands only)
// ---------------------------------------------------------------------------

function parseNums(s: string): number[] {
  return [...s.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)].map((m) =>
    parseFloat(m[0])
  );
}

/** Converts an SVG path d attribute to a list of absolute [x, y] vertices. */
function pathToAbsoluteCoords(d: string): [number, number][] {
  const points: [number, number][] = [];
  let cx = 0;
  let cy = 0;

  for (const seg of d.trim().match(/[MmLlHhVvZz][^MmLlHhVvZz]*/g) ?? []) {
    const cmd = seg[0];
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    const nums = parseNums(seg.slice(1));

    if (upper === "Z") continue;

    if (upper === "M") {
      cx = rel && points.length === 0 ? cx + nums[0] : rel ? cx + nums[0] : nums[0];
      cy = rel && points.length === 0 ? cy + nums[1] : rel ? cy + nums[1] : nums[1];
      points.push([cx, cy]);
      for (let i = 2; i + 1 < nums.length; i += 2) {
        cx = rel ? cx + nums[i] : nums[i];
        cy = rel ? cy + nums[i + 1] : nums[i + 1];
        points.push([cx, cy]);
      }
    } else if (upper === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx = rel ? cx + nums[i] : nums[i];
        cy = rel ? cy + nums[i + 1] : nums[i + 1];
        points.push([cx, cy]);
      }
    } else if (upper === "H") {
      for (const n of nums) { cx = rel ? cx + n : n; points.push([cx, cy]); }
    } else if (upper === "V") {
      for (const n of nums) { cy = rel ? cy + n : n; points.push([cx, cy]); }
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Coordinate normalization
// ---------------------------------------------------------------------------

function normalizePolygons(polygons: [number, number][][]): [number, number][][] {
  const allX = polygons.flat().map(([x]) => x);
  const allY = polygons.flat().map(([, y]) => y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const availW = TARGET_W - PADDING * 2;
  const availH = TARGET_H - PADDING * 2;
  const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
  const offsetX = PADDING + (availW - (maxX - minX) * scale) / 2;
  const offsetY = PADDING + (availH - (maxY - minY) * scale) / 2;

  return polygons.map((poly) =>
    poly.map(([x, y]) => [
      Math.round(((x - minX) * scale + offsetX) * 10) / 10,
      Math.round(((y - minY) * scale + offsetY) * 10) / 10,
    ])
  );
}

function centroid(points: [number, number][]): [number, number] {
  const x = points.reduce((s, [px]) => s + px, 0) / points.length;
  const y = points.reduce((s, [, py]) => s + py, 0) / points.length;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error(`SVG not found: ${SVG_PATH}`);
    process.exit(1);
  }

  console.log(`Reading ${SVG_PATH}…`);
  const svgContent = fs.readFileSync(SVG_PATH, "utf-8");
  const rawLots = extractRawLots(svgContent);
  console.log(`  ${rawLots.length} labeled paths found in lots layer\n`);

  // Query DB keyed by lot_number
  const { data: properties, error } = await supabase
    .from("properties")
    .select("lot_number, membership, membership_type");
  if (error) throw new Error(`DB query failed: ${error.message}`);
  const byLotNumber = new Map((properties ?? []).map((p) => [p.lot_number, p]));

  // Parse paths → absolute coords → normalize
  const parsed = rawLots.map(({ label, d }) => ({ label, coords: pathToAbsoluteCoords(d) }));
  const normalized = normalizePolygons(parsed.map((p) => p.coords));

  const nonLotLabels: string[] = [];   // labels that aren't integers (non-lot areas)
  const noDbMatch: number[] = [];      // valid lot numbers missing from DB
  const seenLotNumbers = new Set<number>();
  const duplicateLabels: string[] = [];

  const output: Array<{
    lotNumber: number | null;
    points: string;
    labelX: number;
    labelY: number;
    membership: string | null;
    membershipType: string | null;
  }> = [];

  for (let i = 0; i < parsed.length; i++) {
    const { label } = parsed[i];
    const normalizedCoords = normalized[i];
    const [labelX, labelY] = centroid(normalizedCoords);
    const points = normalizedCoords.map(([x, y]) => `${x},${y}`).join(" ");

    const lotNumber = parseInt(label, 10);

    // Non-numeric label → inert non-lot area
    if (isNaN(lotNumber)) {
      nonLotLabels.push(label);
      output.push({ lotNumber: null, points, labelX, labelY, membership: null, membershipType: null });
      continue;
    }

    // Duplicate lot number in SVG
    if (seenLotNumbers.has(lotNumber)) {
      duplicateLabels.push(label);
      continue;
    }
    seenLotNumbers.add(lotNumber);

    const prop = byLotNumber.get(lotNumber);
    if (!prop) {
      noDbMatch.push(lotNumber);
      // Still include as inert shape
      output.push({ lotNumber: null, points, labelX, labelY, membership: null, membershipType: null });
      continue;
    }

    output.push({
      lotNumber,
      points,
      labelX,
      labelY,
      membership: prop.membership,
      membershipType: prop.membership_type,
    });
  }

  // DB lots with no SVG polygon
  const svgLotNumbers = new Set(
    rawLots.map((l) => parseInt(l.label, 10)).filter((n) => !isNaN(n))
  );
  const noSvgPolygon = [...byLotNumber.keys()].filter((n) => !svgLotNumbers.has(n));

  // --- Report ---
  console.log("─── Mismatch Report ───────────────────────────────────────\n");

  if (nonLotLabels.length) {
    console.log(`ℹ️  Non-numeric labels (${nonLotLabels.length}) — rendered as inert areas: ${nonLotLabels.join(", ")}\n`);
  }

  if (duplicateLabels.length) {
    console.log(`⚠️  Duplicate lot labels skipped (${duplicateLabels.length}): ${duplicateLabels.join(", ")}\n`);
  }

  if (noDbMatch.length) {
    console.log(`⚠️  Lot numbers in SVG with no DB row (${noDbMatch.length}) — rendered as inert areas:`);
    noDbMatch.forEach((n) => console.log(`    ${n}`));
    console.log();
  }

  if (noSvgPolygon.length) {
    console.log(`ℹ️  DB lots with no SVG polygon (${noSvgPolygon.length}) — missing from tracing:`);
    noSvgPolygon.forEach((n) => console.log(`    lot ${n}`));
    console.log();
  }

  const activeLots = output.filter((o) => o.lotNumber !== null).length;
  if (!nonLotLabels.length && !duplicateLabels.length && !noDbMatch.length && !noSvgPolygon.length) {
    console.log("✓ Perfect match — all SVG polygons matched a DB lot\n");
  }

  if (duplicateLabels.length && !FORCE) {
    console.log("Output not written due to duplicate labels. Fix in Inkscape and re-run, or use --force.");
    process.exit(1);
  }

  // Write output
  const lines = [
    `// AUTO-GENERATED by supabase/generate-map-polygons.ts — do not edit manually.`,
    `// Re-run with: pnpm generate-map`,
    ``,
    `export interface LotPolygon {`,
    `  /** null for non-lot areas (e.g. amenities) — rendered as inert shapes. */`,
    `  lotNumber: number | null;`,
    `  points: string;`,
    `  labelX: number;`,
    `  labelY: number;`,
    `  membership: string | null;`,
    `  membershipType: string | null;`,
    `}`,
    ``,
    `export const LOT_POLYGONS: LotPolygon[] = [`,
    ...output.map(
      (lot) =>
        `  { lotNumber: ${lot.lotNumber}, labelX: ${lot.labelX}, labelY: ${lot.labelY}, membership: ${JSON.stringify(lot.membership)}, membershipType: ${JSON.stringify(lot.membershipType)}, points: "${lot.points}" },`
    ),
    `];`,
    ``,
  ];

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf-8");
  console.log(`✓ Wrote ${output.length} polygons (${activeLots} lots + ${output.length - activeLots} inert) to lib/map-polygons.ts`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
