import { squareToCell, type Grid } from "@snakes-doodle/boards";
import { squareToQuad, type Pt, type Quad } from "./projection";

/**
 * Flat board coordinates are in cell units: c in [0, cols], r in [0, rows], r = 0 at the top.
 * Everything the board draws or animates is built in flat space and projected at render time,
 * so a layout change (phone rotation) never recomputes the seeded art.
 */
export interface FlatPt {
  c: number;
  r: number;
}

export interface BoardGeom {
  rows: number;
  cols: number;
  toScreen(p: FlatPt): Pt;
  /** Screen units per flat cell, horizontally and vertically, around a flat point. */
  scaleAt(p: FlatPt): { sx: number; sy: number };
  /** Nominal cell size in screen units (bottom row) times the layout's ink weight; drives stroke widths. */
  unit: number;
  /** the layout's ink weight already folded into `unit` */
  ink: number;
}

export function makeGeom(grid: Grid, quad: Quad, ink = 1): BoardGeom {
  const map = squareToQuad(quad);
  const toScreen = (p: FlatPt) => map(p.c / grid.cols, p.r / grid.rows);
  const scaleAt = (p: FlatPt) => {
    const l = toScreen({ c: p.c - 0.5, r: p.r });
    const r = toScreen({ c: p.c + 0.5, r: p.r });
    const t = toScreen({ c: p.c, r: p.r - 0.5 });
    const b = toScreen({ c: p.c, r: p.r + 0.5 });
    return { sx: Math.hypot(r.x - l.x, r.y - l.y), sy: Math.hypot(b.x - t.x, b.y - t.y) };
  };
  return {
    rows: grid.rows,
    cols: grid.cols,
    toScreen,
    scaleAt,
    unit: scaleAt({ c: grid.cols / 2, r: grid.rows - 0.5 }).sx * ink,
    ink,
  };
}

export function cellCenter(grid: Grid, square: number): FlatPt {
  const { row, col } = squareToCell(grid, square);
  return { c: col + 0.5, r: row + 0.5 };
}

/**
 * Cell units relative to a 10x10 board. Offsets drawn outside the grid (the waiting row, the
 * "start" label) multiply by this so they sit the same screen distance away on any board size.
 */
export const sizeFactor = (grid: Pick<Grid, "rows" | "cols">) => Math.max(grid.rows, grid.cols) / 10;

/** Where off-board tokens wait: a row under the board's bottom-left corner. */
export function startSpot(grid: Grid, seat: number): FlatPt {
  const k = sizeFactor(grid);
  return { c: (0.4 + seat * 0.62) * k, r: grid.rows + 0.62 * k };
}

export const lerpFlat = (a: FlatPt, b: FlatPt, t: number): FlatPt => ({
  c: a.c + (b.c - a.c) * t,
  r: a.r + (b.r - a.r) * t,
});

export const flatDist = (a: FlatPt, b: FlatPt) => Math.hypot(a.c - b.c, a.r - b.r);

/** Point at fraction t of a polyline's arc length. */
export function alongPolyline(points: FlatPt[], t: number): FlatPt {
  const lens: number[] = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1]! + flatDist(points[i - 1]!, points[i]!));
  const target = lens[lens.length - 1]! * Math.max(0, Math.min(1, t));
  for (let i = 1; i < points.length; i++) {
    if (lens[i]! >= target) {
      const seg = lens[i]! - lens[i - 1]! || 1;
      return lerpFlat(points[i - 1]!, points[i]!, (target - lens[i - 1]!) / seg);
    }
  }
  return points[points.length - 1]!;
}
