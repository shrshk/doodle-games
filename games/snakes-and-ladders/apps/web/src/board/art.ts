import { squareToCell, type Board } from "@snakes-doodle/boards";
import { createRng, hashString } from "@snakes-doodle/engine";
import { cellCenter, flatDist, type FlatPt } from "./geometry";
import { kindOf } from "./snakeKinds";

// Seeded, layout-independent board art in flat cell coordinates. Same board id -> same marks on
// every reload and every client.

export interface SnakeArt {
  from: number;
  to: number;
  style: number;
  /** head -> tail */
  centerline: FlatPt[];
  left: FlatPt[];
  right: FlatPt[];
  length: number;
  /** samples up to the tail square; anything after is a decorative curl */
  bodyCount: number;
}

export interface LadderArt {
  from: number;
  to: number;
  rails: [FlatPt[], FlatPt[]];
  rungs: [FlatPt, FlatPt][];
  /** fraction along foot -> top of each rung, for the rung-by-rung climb */
  rungAt: number[];
  foot: FlatPt;
  top: FlatPt;
  length: number;
}

export interface NumberArt {
  square: number;
  at: FlatPt;
  rot: number;
  red: boolean;
}

export interface BoardArt {
  seed: number;
  /** each grid line, drawn in two pencil passes */
  lines: { main: FlatPt[]; ghost: FlatPt[] }[];
  /** short diagonal pencil strokes per dark cell */
  hatch: { key: string; strokes: [FlatPt, FlatPt][] }[];
  numbers: NumberArt[];
  snakes: SnakeArt[];
  ladders: LadderArt[];
  longestSnake: number | null;
  longestLadder: number | null;
}

type Rng = () => number;
const range = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);

/** A hand-drawn line from a to b: low-frequency wander plus a little tremor. */
function wobblyLine(rng: Rng, a: FlatPt, b: FlatPt, amp: number, segments: number): FlatPt[] {
  const len = flatDist(a, b) || 1;
  const n = { c: -(b.r - a.r) / len, r: (b.c - a.c) / len };
  const k1 = range(rng, -1, 1);
  const k2 = range(rng, -0.5, 0.5);
  const phase = range(rng, 0, Math.PI * 2);
  const pts: FlatPt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const off = amp * (k1 * Math.sin(Math.PI * t) + k2 * Math.sin(2 * Math.PI * t + phase)) + range(rng, -0.25, 0.25) * amp;
    pts.push({ c: a.c + (b.c - a.c) * t + n.c * off, r: a.r + (b.r - a.r) * t + n.r * off });
  }
  return pts;
}

/** Liang-Barsky clip of segment p->q to the box; null when fully outside. */
function clip(p: FlatPt, q: FlatPt, box: { c0: number; r0: number; c1: number; r1: number }): [FlatPt, FlatPt] | null {
  let t0 = 0;
  let t1 = 1;
  const dc = q.c - p.c;
  const dr = q.r - p.r;
  const edges: [number, number][] = [
    [-dc, p.c - box.c0],
    [dc, box.c1 - p.c],
    [-dr, p.r - box.r0],
    [dr, box.r1 - p.r],
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return null;
    } else {
      const t = qq / pp;
      if (pp < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return null;
    }
  }
  return [
    { c: p.c + dc * t0, r: p.r + dr * t0 },
    { c: p.c + dc * t1, r: p.r + dr * t1 },
  ];
}

function buildSnake(rng: Rng, board: Board, s: Board["snakes"][number], index: number): SnakeArt {
  const style = s.style ?? index;
  const kind = kindOf(style);
  const head = cellCenter(board.grid, s.from);
  const tail = cellCenter(board.grid, s.to);
  const len = flatDist(head, tail);
  const dir = { c: (tail.c - head.c) / len, r: (tail.r - head.r) / len };
  const nrm = { c: -dir.r, r: dir.c };
  const waves = Math.max(1, Math.round(((len / 1.9) * kind.waveScale) * 2) / 2);
  const amp = 0.24 + Math.min(0.16, len * 0.016) + (kind.width - 0.2) * 0.5;
  const phase = rng() < 0.5 ? 0 : Math.PI;
  const samples = Math.max(28, Math.round(len * 14));

  const centerline: FlatPt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const env = Math.pow(Math.sin(Math.PI * t), 0.6);
    const off = amp * env * Math.sin(2 * Math.PI * waves * t + phase);
    centerline.push({ c: head.c + dir.c * len * t + nrm.c * off, r: head.r + dir.r * len * t + nrm.r * off });
  }
  const bodyCount = centerline.length;
  if (kind.tail === "curl") {
    // a little pig-tail past the tail square, turning away from the last wave
    const last = centerline[samples]!;
    const prev = centerline[samples - 1]!;
    let ang = Math.atan2(last.r - prev.r, last.c - prev.c);
    const turn = rng() < 0.5 ? 1 : -1;
    let p = last;
    for (let i = 0; i < 12; i++) {
      ang += turn * 0.42;
      const step = 0.045 * (1 - i / 16);
      p = { c: p.c + Math.cos(ang) * step, r: p.r + Math.sin(ang) * step };
      centerline.push(p);
    }
  }

  const n = centerline.length - 1;
  const left: FlatPt[] = [];
  const right: FlatPt[] = [];
  centerline.forEach((p, i) => {
    const a = centerline[Math.max(0, i - 1)]!;
    const b = centerline[Math.min(n, i + 1)]!;
    const tl = flatDist(a, b) || 1;
    const nn = { c: -(b.r - a.r) / tl, r: (b.c - a.c) / tl };
    const t = Math.min(1, i / (bodyCount - 1));
    const curlTaper = i >= bodyCount ? 1 - (i - bodyCount + 1) / (n - bodyCount + 2) : 1;
    const w = (kind.width * (1 - Math.pow(t, 0.85)) + 0.03) * (i >= bodyCount ? 0.9 * curlTaper + 0.1 : 1);
    left.push({ c: p.c + nn.c * w, r: p.r + nn.r * w });
    right.push({ c: p.c - nn.c * w, r: p.r - nn.r * w });
  });

  return { from: s.from, to: s.to, style, centerline, left, right, length: len, bodyCount };
}

function buildLadder(rng: Rng, board: Board, l: Board["ladders"][number]): LadderArt {
  const foot = cellCenter(board.grid, l.from);
  const top = cellCenter(board.grid, l.to);
  const len = flatDist(foot, top);
  const dir = { c: (top.c - foot.c) / len, r: (top.r - foot.r) / len };
  const nrm = { c: -dir.r, r: dir.c };
  const half = 0.17;
  const ext = 0.14;
  const rail = (side: number) =>
    wobblyLine(
      rng,
      { c: foot.c - dir.c * ext + nrm.c * half * side, r: foot.r - dir.r * ext + nrm.r * half * side },
      { c: top.c + dir.c * ext + nrm.c * half * side, r: top.r + dir.r * ext + nrm.r * half * side },
      0.025,
      Math.max(6, Math.round(len * 3)),
    );
  const count = Math.max(2, Math.floor(len / 0.36));
  const rungs: [FlatPt, FlatPt][] = [];
  const rungAt: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    rungAt.push(t);
    const at = (side: number, jitter: number) => ({
      c: foot.c + dir.c * len * (t + jitter) + nrm.c * half * side,
      r: foot.r + dir.r * len * (t + jitter) + nrm.r * half * side,
    });
    rungs.push([at(-1.05, range(rng, -0.02, 0.02)), at(1.05, range(rng, -0.02, 0.02))]);
  }
  return { from: l.from, to: l.to, rails: [rail(-1), rail(1)], rungs, rungAt, foot, top, length: len };
}

export function buildBoardArt(board: Board): BoardArt {
  const seed = hashString(board.id);
  const rng = createRng(seed);
  const { rows, cols } = board.grid;

  const lines: BoardArt["lines"] = [];
  const line = (a: FlatPt, b: FlatPt, segs: number) => ({
    main: wobblyLine(rng, a, b, 0.035, segs),
    ghost: wobblyLine(rng, a, b, 0.05, segs),
  });
  for (let r = 0; r <= rows; r++) {
    lines.push(line({ c: -range(rng, 0.02, 0.16), r }, { c: cols + range(rng, 0.02, 0.18), r }, cols * 2));
  }
  for (let c = 0; c <= cols; c++) {
    lines.push(line({ c, r: -range(rng, 0.02, 0.16) }, { c, r: rows + range(rng, 0.02, 0.2) }, rows * 2));
  }

  const hatch: BoardArt["hatch"] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if ((row + col) % 2 !== 0) continue;
      const box = { c0: col + 0.04, r0: row + 0.04, c1: col + 0.96, r1: row + 0.96 };
      const strokes: [FlatPt, FlatPt][] = [];
      for (let i = 0; i < 95; i++) {
        const mid = { c: col + range(rng, -0.05, 1.05), r: row + range(rng, -0.05, 1.05) };
        const ang = ((-64 + range(rng, -7, 7)) * Math.PI) / 180;
        const half = range(rng, 0.08, 0.17);
        const seg = clip(
          { c: mid.c - Math.cos(ang) * half, r: mid.r - Math.sin(ang) * half },
          { c: mid.c + Math.cos(ang) * half, r: mid.r + Math.sin(ang) * half },
          box,
        );
        if (seg) strokes.push(seg);
      }
      hatch.push({ key: `${row},${col}`, strokes });
    }
  }

  const total = rows * cols;
  const numbers: NumberArt[] = [];
  for (let square = 1; square <= total; square++) {
    const { row, col } = squareToCell(board.grid, square);
    numbers.push({
      square,
      at: { c: col + 0.07 + range(rng, 0, 0.04), r: row + 0.27 + range(rng, -0.02, 0.02) },
      rot: range(rng, -4, 4),
      red: (rows - 1 - row) % 2 === 0,
    });
  }

  const snakes = board.snakes.map((s, i) => buildSnake(rng, board, s, i));
  const ladders = board.ladders.map((l) => buildLadder(rng, board, l));
  const longest = <T extends { length: number; from: number }>(xs: T[]) =>
    xs.length ? xs.reduce((a, b) => (b.length > a.length ? b : a)).from : null;

  return { seed, lines, hatch, numbers, snakes, ladders, longestSnake: longest(snakes), longestLadder: longest(ladders) };
}
