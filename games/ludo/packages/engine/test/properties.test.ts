import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BASE, HOME, SAFE_SQUARES, botMove, createGame, reduce, trackSquare, type GameState, type RuleSet } from "../src";

const rulesArb: fc.Arbitrary<RuleSet> = fc.record({
  needSixToStart: fc.boolean(),
  sixAgain: fc.boolean(),
  threeSixesForfeit: fc.boolean(),
  cutBonus: fc.boolean(),
  homeBonus: fc.boolean(),
  safeSquares: fc.boolean(),
  blocks: fc.boolean(),
  playForPlaces: fc.boolean(),
});
const seatsArb = fc.constantFrom([0, 2], [1, 3], [0, 1, 2], [0, 1, 2, 3], [0, 1, 3]);

const newGame = (seed: number, seats: number[], rules: RuleSet) =>
  createGame({ players: seats.map((seat) => ({ id: `p${seat}`, name: `P${seat}`, color: "red", seat, isBot: true })), rules, seed });

function assertInvariants(s: GameState) {
  for (const p of s.players) {
    expect(p.tokens).toHaveLength(4);
    for (const t of p.tokens) expect(t === BASE || (t >= 0 && t <= HOME)).toBe(true);
  }
  // off the safe squares, a shared square never holds two colours at once: a landing always cuts
  if (s.rules.safeSquares) {
    const owners = new Map<number, Set<string>>();
    for (const p of s.players) {
      for (const t of p.tokens) {
        const sq = trackSquare(p.seat, t);
        if (sq === null || SAFE_SQUARES.has(sq)) continue;
        owners.set(sq, (owners.get(sq) ?? new Set()).add(p.id));
      }
    }
    for (const set of owners.values()) expect(set.size).toBe(1);
  }
  const places = s.players.flatMap((p) => (p.finishedPlace ? [p.finishedPlace] : []));
  expect(new Set(places).size).toBe(places.length);
}

/** Plays a bot-vs-bot game to the end; returns the final state and the actions taken. */
function playOut(start: GameState) {
  let s = start;
  let actions = 0;
  while (s.turn.phase !== "gameOver") {
    if (++actions > 100_000) throw new Error("game did not end");
    const phase = s.turn.phase;
    const action =
      phase === "awaitingRoll"
        ? { type: "ROLL" as const, playerId: s.turn.playerId }
        : phase === "awaitingMove"
          ? { type: "MOVE" as const, playerId: s.turn.playerId, token: botMove(s)! }
          : { type: "ANIMATION_DONE" as const };
    const r = reduce(s, action);
    expect(r.error).toBeUndefined();
    s = r.state;
    assertInvariants(s);
  }
  return { state: s, actions };
}

describe("engine properties", () => {
  it("every game ends with tokens in range, one colour per unsafe square, and a winner", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), seatsArb, rulesArb, (seed, seats, rules) => {
        const { state } = playOut(newGame(seed, seats, rules));
        expect(state.players.some((p) => p.finishedPlace === 1 && p.tokens.every((t) => t === HOME))).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it("a game is a pure function of its seed and actions: replaying gives the same log", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const a = playOut(newGame(seed, [0, 1, 2, 3], { ...rulesDefault }));
        const b = playOut(newGame(seed, [0, 1, 2, 3], { ...rulesDefault }));
        expect(b.state.log).toEqual(a.state.log);
      }),
      { numRuns: 10 },
    );
  });

  it("a bot always picks a token the roll can move", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        let s = newGame(seed, [0, 2], rulesDefault);
        for (let i = 0; i < 400 && s.turn.phase !== "gameOver"; i++) {
          if (s.turn.phase === "awaitingMove") expect(s.turn.movable).toContain(botMove(s));
          const phase = s.turn.phase;
          s = reduce(s, phase === "awaitingRoll" ? { type: "ROLL", playerId: s.turn.playerId } : phase === "awaitingMove" ? { type: "MOVE", playerId: s.turn.playerId, token: botMove(s)! } : { type: "ANIMATION_DONE" }).state;
        }
      }),
      { numRuns: 20 },
    );
  });
});

const rulesDefault: RuleSet = {
  needSixToStart: true,
  sixAgain: true,
  threeSixesForfeit: true,
  cutBonus: true,
  homeBonus: true,
  safeSquares: true,
  blocks: false,
  playForPlaces: false,
};
