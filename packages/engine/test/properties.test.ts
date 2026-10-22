import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { classic100 } from "@snakes-doodle/boards";
import { createGame, reduce, type Action, type GameState, type RuleSet } from "../src";

const rulesArb: fc.Arbitrary<RuleSet> = fc.record({
  chainJumps: fc.boolean(),
  overshoot: fc.constantFrom("stay" as const, "bounce" as const),
  sixRule: fc.boolean(),
  startOnSix: fc.boolean(),
  playForPlaces: fc.boolean(),
});

const newGame = (seed: number, players: number, rules: RuleSet) =>
  createGame({
    board: classic100,
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: "red" })),
    rules,
    seed,
  });

function assertInvariants(s: GameState) {
  for (const p of s.players) {
    expect(p.position).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeLessThanOrEqual(s.track.finalSquare);
    expect(s.track.jumps[p.position]).toBeUndefined();
  }
  const places = s.players.flatMap((p) => (p.finishedPlace ? [p.finishedPlace] : []));
  expect(new Set(places).size).toBe(places.length);
}

const MAX_ACTIONS = 100_000;

describe("engine properties", () => {
  it("every game terminates with positions in range", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.integer({ min: 2, max: 4 }), rulesArb, (seed, n, rules) => {
        let s = newGame(seed, n, rules);
        let actions = 0;
        while (s.turn.phase !== "gameOver") {
          const action: Action =
            s.turn.phase === "animating" ? { type: "ANIMATION_DONE" } : { type: "ROLL", playerId: s.turn.playerId };
          const r = reduce(s, action);
          expect(r.error).toBeUndefined();
          s = r.state;
          assertInvariants(s);
          if (++actions > MAX_ACTIONS) throw new Error("game did not terminate");
        }
        const winners = s.players.filter((p) => p.finishedPlace === 1);
        expect(winners).toHaveLength(1);
        if (rules.playForPlaces) expect(s.players.every((p) => p.finishedPlace !== undefined)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("random action sequences never break invariants", () => {
    const actionArb = fc.oneof(
      fc.record({ type: fc.constant("ROLL" as const), playerId: fc.constantFrom("p0", "p1", "p2", "p3") }),
      fc.constant({ type: "ANIMATION_DONE" as const }),
      fc.record({ type: fc.constant("SKIP_TURN" as const), playerId: fc.constantFrom("p0", "p1", "p2", "p3") }),
      fc.record({ type: fc.constant("RESIGN" as const), playerId: fc.constantFrom("p0", "p1", "p2", "p3") }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), rulesArb, fc.array(actionArb, { maxLength: 300 }), (seed, rules, actions) => {
        let s = newGame(seed, 4, rules);
        for (const a of actions) {
          const before = s;
          const r = reduce(s, a);
          if (r.error) expect(r.state).toBe(before);
          s = r.state;
          assertInvariants(s);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("replays identically from the same seed and actions", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), rulesArb, (seed, rules) => {
        const play = () => {
          let s = newGame(seed, 3, rules);
          for (let i = 0; i < 200 && s.turn.phase !== "gameOver"; i++) {
            const a: Action =
              s.turn.phase === "animating" ? { type: "ANIMATION_DONE" } : { type: "ROLL", playerId: s.turn.playerId };
            s = reduce(s, a).state;
          }
          return s;
        };
        expect(play()).toEqual(play());
      }),
      { numRuns: 50 },
    );
  });
});
