import type { Board } from "@snakes-doodle/boards";
import { createGame, reduce } from "./game";
import type { RuleSet } from "./types";

export interface BalanceReport {
  games: number;
  /** turns for one token to reach the final square, counting every roll (extra rolls on a 6 too) */
  median: number;
  p90: number;
  mean: number;
  /** share of rolls that land on a snake head / ladder foot */
  snakeRate: number;
  ladderRate: number;
}

/**
 * Plays `games` solo games on a board and reports how long a token takes to finish. Solo play makes
 * the number independent of how many players sit at the table. Deterministic for a given seed.
 */
export function simulate(board: Board, { games = 10_000, seed = 1, rules = {} }: { games?: number; seed?: number; rules?: Partial<RuleSet> } = {}): BalanceReport {
  const turns: number[] = [];
  let rolls = 0;
  let snakes = 0;
  let ladders = 0;
  for (let g = 0; g < games; g++) {
    // two seats so createGame accepts it; only the first ever moves (the second always skips)
    let s = createGame({
      board,
      players: [
        { id: "solo", name: "solo", color: "red" },
        { id: "idle", name: "idle", color: "blue" },
      ],
      rules,
      seed: seed + g * 7919,
    });
    let count = 0;
    while (s.players[0]!.finishedPlace === undefined && count < 5_000) {
      if (s.turn.phase === "animating") {
        s = reduce(s, { type: "ANIMATION_DONE" }).state;
      } else if (s.turn.playerId === "idle") {
        s = reduce(s, { type: "SKIP_TURN", playerId: "idle" }).state;
      } else {
        const r = reduce(s, { type: "ROLL", playerId: "solo" });
        count++;
        for (const e of r.events) {
          if (e.type === "SNAKE") snakes++;
          if (e.type === "LADDER") ladders++;
        }
        s = r.state;
      }
    }
    rolls += count;
    turns.push(count);
  }
  turns.sort((a, b) => a - b);
  const at = (q: number) => turns[Math.min(turns.length - 1, Math.floor(q * turns.length))]!;
  return {
    games,
    median: at(0.5),
    p90: at(0.9),
    mean: rolls / games,
    snakeRate: snakes / rolls,
    ladderRate: ladders / rolls,
  };
}
