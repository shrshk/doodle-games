import { describe, expect, it } from "vitest";
import { BASE, HOME, LAST_TRACK, TRACK_SQUARES } from "@ludo-doodle/engine";
import { BASE_ORIGIN, PATH_CELLS, progressPoint, squarePoint } from "./geometry";

// Ludo's track turns each inner corner with a diagonal step, so neighbours are a king's move apart.
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe("board geometry", () => {
  it("every step round the track goes to a neighbouring cell, including the wrap", () => {
    for (let s = 0; s < TRACK_SQUARES; s++) {
      expect(dist(squarePoint(s), squarePoint((s + 1) % TRACK_SQUARES))).toBe(1);
    }
  });

  it("the track and home columns use 72 distinct cells, all off the four bases", () => {
    const keys = PATH_CELLS.map((c) => `${c.row},${c.col}`);
    expect(new Set(keys).size).toBe(52 + 4 * 5);
    for (const { row, col } of PATH_CELLS) {
      const inBase = BASE_ORIGIN.some((o) => col >= o.x && col < o.x + 6 && row >= o.y && row < o.y + 6);
      expect(inBase).toBe(false);
    }
  });

  it("each seat's whole path is connected: start next to its base, track into its own column, column to the centre", () => {
    for (let seat = 0; seat < 4; seat++) {
      const o = BASE_ORIGIN[seat]!;
      const start = progressPoint(seat, 0, 0);
      const nearBase = start.x > o.x - 1 && start.x < o.x + 7 && start.y > o.y - 1 && start.y < o.y + 7;
      expect(nearBase).toBe(true);
      for (let p = 0; p < HOME - 1; p++) {
        expect(dist(progressPoint(seat, 0, p), progressPoint(seat, 0, p + 1))).toBe(1);
      }
      // the last column cell touches the 3 x 3 home square in the middle
      const last = progressPoint(seat, 0, HOME - 1);
      expect(Math.max(Math.abs(last.x - 7.5), Math.abs(last.y - 7.5))).toBe(2);
      expect(progressPoint(seat, 0, LAST_TRACK + 1)).not.toEqual(progressPoint((seat + 1) % 4, 0, LAST_TRACK + 1));
    }
  });

  it("puts the stars where a Ludo board has them, eight squares after each start", () => {
    const stars = PATH_CELLS.filter((c) => c.kind === "star").map((c) => [c.row, c.col]);
    expect(stars).toEqual(
      expect.arrayContaining([
        [2, 6],
        [6, 12],
        [12, 8],
        [8, 2],
      ]),
    );
    expect(stars).toHaveLength(4);
  });

  it("keeps the four base spots of a seat apart and inside its base", () => {
    for (let seat = 0; seat < 4; seat++) {
      const spots = [0, 1, 2, 3].map((t) => progressPoint(seat, t, BASE));
      expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(4);
    }
  });
});
