import { parseBoard, type Board } from "@snakes-doodle/boards";
import { createGame, reduce, rollDie, type Action, type GameState, type ReduceResult, type RuleSet } from "../src";

export function makeBoard(
  snakes: [number, number][] = [],
  ladders: [number, number][] = [],
  rows = 4,
  cols = 4,
): Board {
  return parseBoard({
    schemaVersion: 1,
    id: "test",
    name: "Test",
    grid: { rows, cols },
    snakes: snakes.map(([from, to]) => ({ from, to })),
    ladders: ladders.map(([from, to]) => ({ from, to })),
  });
}

/** First seed whose die sequence starts with `values` (rolls are global across players). */
export function seedFor(values: number[]): number {
  for (let seed = 1; ; seed++) {
    let rng = { seed, cursor: 0 };
    let ok = true;
    for (const v of values) {
      const r = rollDie(rng);
      if (r.value !== v) {
        ok = false;
        break;
      }
      rng = r.rng;
    }
    if (ok) return seed;
  }
}

export function newGame(
  board: Board,
  rolls: number[],
  opts: { players?: number; rules?: Partial<RuleSet> } = {},
): GameState {
  const n = opts.players ?? 2;
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, color: "red" }));
  return createGame({ board, players, rules: opts.rules, seed: seedFor(rolls) });
}

/** Puts tokens on squares; the current player's turn restarts from its new square. */
export function place(state: GameState, positions: Record<string, number>): GameState {
  const players = state.players.map((p) => (p.id in positions ? { ...p, position: positions[p.id]! } : p));
  const current = players.find((p) => p.id === state.turn.playerId)!;
  return { ...state, players, turn: { ...state.turn, startPosition: current.position } };
}

/** Applies actions in order and throws on any rejection. */
export function run(state: GameState, ...actions: Action[]): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const a of actions) {
    result = reduce(result.state, a);
    if (result.error) throw new Error(`${a.type} rejected: ${result.error}`);
  }
  return result;
}

export const ROLL = (playerId: string): Action => ({ type: "ROLL", playerId });
export const DONE: Action = { type: "ANIMATION_DONE" };
