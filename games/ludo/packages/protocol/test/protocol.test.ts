import { expect, it } from "vitest";
import { createGame } from "@ludo-doodle/engine";
import { PACE, publicGame, stepPlaybackMs } from "../src";

it("a roll that moves the only token: dice, the pause before the move, the hops, the hand-over", () => {
  const ms = stepPlaybackMs(
    [
      { type: "ROLLED", playerId: "a", value: 3 },
      { type: "MOVED", playerId: "a", token: 0, from: 4, to: 7 },
    ],
    true,
  );
  expect(ms).toBe(PACE.diceTumble + PACE.afterDice + PACE.autoMove + 3 * PACE.hopPerSquare + PACE.afterLanding + PACE.handoff);
});

it("a picked move has no auto-move pause, and no hand-over when the player rolls again", () => {
  const ms = stepPlaybackMs(
    [
      { type: "MOVED", playerId: "a", token: 0, from: 4, to: 10 },
      { type: "EXTRA_TURN", playerId: "a", reason: "six" },
    ],
    false,
  );
  expect(ms).toBe(6 * PACE.hopPerSquare + PACE.afterLanding + PACE.extraTurn);
});

it("publicGame drops the RNG and the log", () => {
  const game = createGame({ players: [{ id: "a", name: "A", color: "red", seat: 0 }, { id: "b", name: "B", color: "orange", seat: 2 }], seed: 7 });
  const pub = publicGame(game);
  expect(pub).not.toHaveProperty("rng");
  expect(pub).not.toHaveProperty("log");
  expect(pub.players).toHaveLength(2);
});
