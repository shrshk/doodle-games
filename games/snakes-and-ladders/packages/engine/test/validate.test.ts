import { describe, expect, it } from "vitest";
import { classic100 } from "@snakes-doodle/boards";
import { validateBoard } from "../src";
import { makeBoard } from "./helpers";

const errorsOf = (...args: Parameters<typeof makeBoard>) => validateBoard(makeBoard(...args)).errors;

describe("validateBoard", () => {
  it("accepts Classic 100", () => {
    expect(validateBoard(classic100)).toEqual({ ok: true, errors: [] });
    expect(validateBoard(classic100, { chainJumps: true }).ok).toBe(true);
  });

  it("checks direction and range", () => {
    expect(errorsOf([[3, 9]])).toContain("snake 3->9 must go down");
    expect(errorsOf([], [[9, 3]])).toContain("ladder 9->3 must go up");
    expect(errorsOf([], [[3, 17]])).toContain("ladder 3->17 is outside 1..16");
  });

  it("forbids jumps touching the start or final square", () => {
    expect(errorsOf([], [[3, 16]])).toContain("ladder 3->16 jumps into the final square");
    expect(errorsOf([[16, 4]])).toContain("snake 16->4 starts on the final square");
    expect(errorsOf([[9, 1]])).toContain("snake 9->1 jumps into the start square");
  });

  it("forbids a snake and a ladder starting on the same square", () => {
    expect(errorsOf([[8, 2]], [[8, 12]])).toContain("square 8 starts more than one snake or ladder");
  });

  it("detects chained loops only when chaining is on", () => {
    const board = makeBoard([[10, 4]], [[4, 10]]);
    expect(validateBoard(board).ok).toBe(true);
    expect(validateBoard(board, { chainJumps: true }).errors).toContain("chained jumps from 10 loop forever");
  });

  it("finds squares that can never be reached", () => {
    // 4..9 all slide back to 3, so nothing past 9 is reachable
    const snakes: [number, number][] = [4, 5, 6, 7, 8, 9].map((s) => [s, 3]);
    const { errors } = validateBoard(makeBoard(snakes));
    expect(errors).toContain("square 10 can never be reached");
  });

  it("finds tokens that can never finish", () => {
    // 10..15 all slide back to 9, so a token on 9 can never reach 16
    const snakes: [number, number][] = [10, 11, 12, 13, 14, 15].map((s) => [s, 9]);
    const { errors } = validateBoard(makeBoard(snakes));
    expect(errors).toContain("a token on square 9 can never finish");
    expect(errors).toContain("square 16 can never be reached");
  });

  it("checks custom layouts list every cell once", () => {
    const board = makeBoard();
    const bad = { ...board, grid: { ...board.grid, layout: "custom" as const, customOrder: [[0, 0]] as [number, number][] } };
    expect(validateBoard(bad).errors[0]).toMatch(/customOrder/);
  });
});
