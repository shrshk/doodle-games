import { createGame, reduce, rollDie, type Action, type GameState, type ReduceResult, type RuleSet } from "../src";

/** First seed whose die rolls start with `values`. */
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

/**
 * A game with players on the given seats ("p<seat>" ids), tokens already placed, and the die set to
 * roll `rolls` in order.
 */
export function setup({
  seats = [0, 2],
  tokens = {},
  rolls = [],
  rules = {},
}: {
  seats?: number[];
  tokens?: Record<string, number[]>;
  rolls?: number[];
  rules?: Partial<RuleSet>;
}): GameState {
  const game = createGame({
    players: seats.map((seat) => ({ id: `p${seat}`, name: `P${seat}`, color: "red", seat })),
    rules,
    seed: seedFor(rolls),
  });
  return { ...game, players: game.players.map((p) => (tokens[p.id] ? { ...p, tokens: [...tokens[p.id]!] } : p)) };
}

/** Applies actions in order, failing on any rejected one; returns the last result. */
export function run(state: GameState, ...actions: Action[]): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const a of actions) {
    result = reduce(result.state, a);
    if (result.error) throw new Error(`${a.type} rejected: ${result.error}`);
  }
  return result;
}

export const tokensOf = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.tokens;
