import { describe, expect, it } from "vitest";
import { classic100 } from "@snakes-doodle/boards";
import { createGame } from "@snakes-doodle/engine";
import { CODE_ALPHABET, PACE, isRoomCode, normalizeCode, publicGame, turnPlaybackMs } from "../src";

describe("room codes", () => {
  it("accepts six readable characters and nothing else", () => {
    expect(isRoomCode("ABC234")).toBe(true);
    expect(isRoomCode("ABC23")).toBe(false);
    expect(isRoomCode("ABCO01")).toBe(false); // O, 0 and 1 are never used
    expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("forgives how people type a code", () => {
    expect(normalizeCode(" abc-234 ")).toBe("ABC234");
  });
});

describe("turnPlaybackMs", () => {
  it("adds up the moves of a turn plus the hand-over", () => {
    const ms = turnPlaybackMs(
      [
        { type: "ROLLED", playerId: "a", value: 3 },
        { type: "MOVED", playerId: "a", from: 0, to: 3, path: [1, 2, 3] },
      ],
      classic100,
    );
    expect(ms).toBe(PACE.diceTumble + PACE.afterDice + PACE.beforeHop + 3 * PACE.hopPerSquare + PACE.afterLanding + PACE.handoff);
  });

  it("takes longer for a long snake than a short one", () => {
    const [long, short] = [...classic100.snakes].sort((a, b) => b.from - b.to - (a.from - a.to));
    const snakeMs = (s: { from: number; to: number }) => turnPlaybackMs([{ type: "SNAKE", playerId: "a", ...s }], classic100);
    expect(snakeMs(long!)).toBeGreaterThanOrEqual(snakeMs(short!));
  });
});

it("publicGame drops the RNG and the log", () => {
  const game = createGame({ board: classic100, players: [{ id: "a", name: "A", color: "red" }, { id: "b", name: "B", color: "yellow" }], seed: 7 });
  const pub = publicGame(game);
  expect(pub).not.toHaveProperty("rng");
  expect(pub).not.toHaveProperty("log");
  expect(pub.players).toHaveLength(2);
});
