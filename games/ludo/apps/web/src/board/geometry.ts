// Where things sit on the 15 x 15 Ludo board, in cell units: (x, y) with (0, 0) the top-left corner,
// so a cell's centre is (col + 0.5, row + 0.5). The engine only knows progress numbers; this maps
// them onto the board. Seats go clockwise: 0 top-left (red), 1 top-right (yellow),
// 2 bottom-right (orange), 3 bottom-left (indigo).
import { BASE, HOME, LAST_TRACK, SAFE_SQUARES, TRACK_SQUARES } from "@ludo-doodle/engine";

export const N = 15;

export interface Pt {
  x: number;
  y: number;
}

type Cell = [row: number, col: number];

/**
 * The 52 track cells in playing order, starting one cell before seat 0's start square, so the
 * engine's shared square s is LOOP[(s + 1) % 52].
 */
const LOOP: Cell[] = (() => {
  const out: Cell[] = [];
  const run = (cells: Cell[]) => out.push(...cells);
  const range = (a: number, b: number) => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : Array.from({ length: a - b + 1 }, (_, i) => a - i));
  run(range(0, 5).map((c) => [6, c])); // left arm, top row, heading right
  run(range(5, 0).map((r) => [r, 6])); // up the top arm's left column
  run([[0, 7], [0, 8]]);
  run(range(1, 5).map((r) => [r, 8])); // down the top arm's right column
  run(range(9, 14).map((c) => [6, c])); // right arm, top row
  run([[7, 14], [8, 14]]);
  run(range(13, 9).map((c) => [8, c])); // right arm, bottom row, heading left
  run(range(9, 14).map((r) => [r, 8])); // down the bottom arm's right column
  run([[14, 7], [14, 6]]);
  run(range(13, 9).map((r) => [r, 6])); // up the bottom arm's left column
  run(range(5, 0).map((c) => [8, c])); // left arm, bottom row, heading left
  run([[7, 0]]);
  if (out.length !== TRACK_SQUARES) throw new Error(`track has ${out.length} cells`);
  return out;
})();

/** Each seat's home column, from its entry to the cell before home. */
const HOME_COLUMN: Cell[][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as Cell),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as Cell),
  [13, 12, 11, 10, 9].map((c) => [7, c] as Cell),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as Cell),
];

/** Top-left cell of each seat's 6 x 6 base. */
export const BASE_ORIGIN: Pt[] = [
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 9 },
  { x: 0, y: 9 },
];

const centre = ([r, c]: Cell): Pt => ({ x: c + 0.5, y: r + 0.5 });

/** The cell centre for engine square s (0 = seat 0's start square). */
export const squarePoint = (square: number): Pt => centre(LOOP[(square + 1) % TRACK_SQUARES]!);
export const squareCell = (square: number): Cell => LOOP[(square + 1) % TRACK_SQUARES]!;

/** Where token `token` of `seat` waits in its base. */
export function basePoint(seat: number, token: number): Pt {
  const o = BASE_ORIGIN[seat]!;
  return { x: o.x + (token % 2 === 0 ? 2 : 4), y: o.y + (token < 2 ? 2 : 4) };
}

/** Where a finished token rests, in its seat's triangle of the home square. */
export function homePoint(seat: number, token: number): Pt {
  const spread = (token - 1.5) * 0.32;
  return [
    { x: 6.55, y: 7.5 + spread },
    { x: 7.5 + spread, y: 6.55 },
    { x: 8.45, y: 7.5 + spread },
    { x: 7.5 + spread, y: 8.45 },
  ][seat]!;
}

/** The board point for a token's progress. */
export function progressPoint(seat: number, token: number, progress: number): Pt {
  if (progress === BASE) return basePoint(seat, token);
  if (progress === HOME) return homePoint(seat, token);
  if (progress > LAST_TRACK) return centre(HOME_COLUMN[seat]![progress - LAST_TRACK - 1]!);
  return squarePoint((seat * 13 + progress) % TRACK_SQUARES);
}

/** Every cell of the cross that is part of a path (track and home columns), with what it is. */
export interface PathCell {
  row: number;
  col: number;
  /** seat that owns it: its start square or home column */
  seat?: number;
  kind: "track" | "start" | "star" | "column";
}

export const PATH_CELLS: PathCell[] = [
  ...LOOP.map(([row, col], i): PathCell => {
    const square = (i - 1 + TRACK_SQUARES) % TRACK_SQUARES;
    if (square % 13 === 0) return { row, col, seat: square / 13, kind: "start" };
    if (SAFE_SQUARES.has(square)) return { row, col, kind: "star" };
    return { row, col, kind: "track" };
  }),
  ...HOME_COLUMN.flatMap((cells, seat) => cells.map(([row, col]): PathCell => ({ row, col, seat, kind: "column" }))),
];
