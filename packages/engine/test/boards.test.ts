import { describe, expect, it } from "vitest";
import { inbuiltBoards } from "@snakes-doodle/boards";
import { simulate, validateBoard, type BalanceReport } from "../src";

/** Handoff table: grid and snake / ladder counts per inbuilt board. */
const SPEC: Record<string, { grid: string; snakes: number; ladders: number }> = {
  "classic-100": { grid: "10x10", snakes: 8, ladders: 8 },
  "quick-doodle": { grid: "6x6", snakes: 3, ladders: 3 },
  "snake-pit": { grid: "10x10", snakes: 14, ladders: 5 },
  "ladder-climb": { grid: "10x10", snakes: 4, ladders: 12 },
  "spiral-notebook": { grid: "8x8", snakes: 6, ladders: 6 },
  "moksha-patam": { grid: "8x9", snakes: 10, ladders: 9 },
  "big-sheet": { grid: "12x12", snakes: 12, ladders: 12 },
  "garden-party": { grid: "10x10", snakes: 10, ladders: 10 },
  "mountain-path": { grid: "10x10", snakes: 4, ladders: 4 },
  "pocket-sheet": { grid: "7x7", snakes: 4, ladders: 4 },
};

/**
 * Median solo game length (rolls for one token to finish, default rules). The handoff sets 25-45
 * for 10x10 boards; the other sizes scale with the number of squares.
 */
const TARGET: Record<string, [number, number]> = {
  "10x10": [25, 45],
  "6x6": [8, 18],
  "7x7": [10, 26],
  "8x8": [15, 40],
  "8x9": [15, 40],
  "12x12": [40, 65],
};

const reports = new Map<string, BalanceReport>();
const report = (id: string) => {
  let r = reports.get(id);
  if (!r) {
    r = simulate(inbuiltBoards.find((b) => b.id === id)!, { games: 10_000 });
    reports.set(id, r);
  }
  return r;
};

describe("inbuilt boards", () => {
  it("ships all seven from the handoff", () => {
    expect(inbuiltBoards.map((b) => b.id).sort()).toEqual(Object.keys(SPEC).sort());
  });

  it.each(inbuiltBoards.map((b) => [b.id, b] as const))("%s matches its spec and validates", (id, b) => {
    const spec = SPEC[id]!;
    expect(`${b.grid.rows}x${b.grid.cols}`).toBe(spec.grid);
    expect(b.snakes).toHaveLength(spec.snakes);
    expect(b.ladders).toHaveLength(spec.ladders);
    expect(validateBoard(b).errors).toEqual([]);
    expect(validateBoard(b, { chainJumps: true }).errors).toEqual([]);
  });

  it.each(inbuiltBoards.map((b) => [b.id, b] as const))("%s is balanced", (id, b) => {
    const [lo, hi] = TARGET[`${b.grid.rows}x${b.grid.cols}`]!;
    const r = report(id);
    expect(r.median).toBeGreaterThanOrEqual(lo);
    expect(r.median).toBeLessThanOrEqual(hi);
  });

  it("keeps each board's personality", () => {
    expect(report("snake-pit").median).toBeGreaterThan(report("classic-100").median);
    expect(report("classic-100").median).toBeGreaterThan(report("ladder-climb").median);
    // a few huge jumps: the slow games run much longer than on the classic board
    expect(report("mountain-path").p90).toBeGreaterThan(report("classic-100").p90 * 1.3);
    // many small jumps: something happens on more turns than on the classic board
    const busy = (id: string) => report(id).snakeRate + report(id).ladderRate;
    expect(busy("garden-party")).toBeGreaterThan(busy("classic-100"));
  });

  it("prints the balance table", () => {
    // the engine compiles without DOM or Node types (purity), so reach console through globalThis
    const { console } = globalThis as unknown as { console: { table(rows: unknown[]): void } };
    console.table(
      inbuiltBoards.map((b) => {
        const r = report(b.id);
        return {
          board: b.id,
          grid: `${b.grid.rows}x${b.grid.cols}`,
          median: r.median,
          p90: r.p90,
          snakeHit: `${(r.snakeRate * 100).toFixed(1)}%`,
          ladderHit: `${(r.ladderRate * 100).toFixed(1)}%`,
        };
      }),
    );
  });
});
