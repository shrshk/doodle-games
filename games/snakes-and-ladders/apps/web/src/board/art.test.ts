import { describe, expect, it } from "vitest";
import { classic100 } from "@snakes-doodle/boards";
import { buildBoardArt } from "./art";
import { makeGeom } from "./geometry";
import { LANDSCAPE, PORTRAIT } from "./layout";
import { squareToQuad } from "./projection";

describe("board art", () => {
  it("is identical for the same board on every build (same wobble across reloads)", () => {
    expect(JSON.stringify(buildBoardArt(classic100))).toBe(JSON.stringify(buildBoardArt(classic100)));
  });

  it("changes with the board id", () => {
    const other = { ...classic100, id: "classic-100-copy" };
    expect(buildBoardArt(other).seed).not.toBe(buildBoardArt(classic100).seed);
  });

  it("draws one snake per board snake, head first", () => {
    const art = buildBoardArt(classic100);
    expect(art.snakes).toHaveLength(classic100.snakes.length);
    expect(art.ladders).toHaveLength(classic100.ladders.length);
    expect(art.longestSnake).toBe(87);
  });
});

describe("projection", () => {
  it("maps the unit square corners onto the quad", () => {
    const quad = LANDSCAPE.quad;
    const map = squareToQuad(quad);
    const corners = [map(0, 0), map(1, 0), map(1, 1), map(0, 1)];
    corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(quad[i]!.x, 6);
      expect(p.y).toBeCloseTo(quad[i]!.y, 6);
    });
  });

  it("foreshortens rows toward the narrow top edge", () => {
    for (const layout of [LANDSCAPE, PORTRAIT]) {
      const geom = makeGeom(classic100.grid, layout.quad);
      const top = geom.scaleAt({ c: 5, r: 0.5 });
      const bottom = geom.scaleAt({ c: 5, r: 9.5 });
      expect(top.sx).toBeLessThan(bottom.sx);
      expect(top.sy).toBeLessThan(bottom.sy);
    }
  });
});
