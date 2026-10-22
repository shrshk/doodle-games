import { describe, expect, it } from "vitest";
import { classic100, parseBoard, squareToCell } from "./index";

describe("squareToCell", () => {
  const grid = classic100.grid;

  it("starts bottom-left and snakes back and forth", () => {
    expect(squareToCell(grid, 1)).toEqual({ row: 9, col: 0 });
    expect(squareToCell(grid, 10)).toEqual({ row: 9, col: 9 });
    expect(squareToCell(grid, 11)).toEqual({ row: 8, col: 9 });
    expect(squareToCell(grid, 20)).toEqual({ row: 8, col: 0 });
    expect(squareToCell(grid, 100)).toEqual({ row: 0, col: 0 });
  });

  it("mirrors for a bottom-right origin", () => {
    const g = { ...grid, origin: "bottom-right" as const };
    expect(squareToCell(g, 1)).toEqual({ row: 9, col: 9 });
    expect(squareToCell(g, 11)).toEqual({ row: 8, col: 0 });
  });

  it("maps every square to a distinct cell", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 100; s++) {
      const { row, col } = squareToCell(grid, s);
      seen.add(`${row},${col}`);
    }
    expect(seen.size).toBe(100);
  });

  it("rejects squares outside the board", () => {
    expect(() => squareToCell(grid, 0)).toThrow(RangeError);
    expect(() => squareToCell(grid, 101)).toThrow(RangeError);
  });
});

describe("BoardSchema", () => {
  it("fills defaults", () => {
    const b = parseBoard({ schemaVersion: 1, id: "x", name: "X", grid: { rows: 4, cols: 4 }, snakes: [], ladders: [] });
    expect(b.author).toBe("inbuilt");
    expect(b.grid.layout).toBe("boustrophedon");
    expect(b.grid.origin).toBe("bottom-left");
  });

  it("rejects out-of-range grids", () => {
    expect(() =>
      parseBoard({ schemaVersion: 1, id: "x", name: "X", grid: { rows: 3, cols: 4 }, snakes: [], ladders: [] }),
    ).toThrow();
  });
});

describe("spiral layout", () => {
  const grid = { rows: 8, cols: 8, layout: "spiral" as const, origin: "bottom-left" as const };

  it("runs along the bottom edge, up the right, and finishes in the middle", () => {
    expect(squareToCell(grid, 1)).toEqual({ row: 7, col: 0 });
    expect(squareToCell(grid, 8)).toEqual({ row: 7, col: 7 });
    expect(squareToCell(grid, 9)).toEqual({ row: 6, col: 7 });
    expect(squareToCell(grid, 15)).toEqual({ row: 0, col: 7 });
    const last = squareToCell(grid, 64);
    expect(last.row === 3 || last.row === 4).toBe(true);
    expect(last.col === 3 || last.col === 4).toBe(true);
  });

  it("visits every cell once, each step to a neighbour", () => {
    for (const [rows, cols] of [[8, 8], [6, 6], [9, 8], [5, 7]] as const) {
      const g = { rows, cols, layout: "spiral" as const, origin: "bottom-left" as const };
      const seen = new Set<string>();
      let prev = squareToCell(g, 1);
      for (let s = 1; s <= rows * cols; s++) {
        const c = squareToCell(g, s);
        seen.add(`${c.row},${c.col}`);
        if (s > 1) expect(Math.abs(c.row - prev.row) + Math.abs(c.col - prev.col)).toBe(1);
        prev = c;
      }
      expect(seen.size).toBe(rows * cols);
    }
  });

  it("mirrors for a bottom-right origin", () => {
    expect(squareToCell({ ...grid, origin: "bottom-right" }, 1)).toEqual({ row: 7, col: 7 });
  });
});
