import { BASE, HOME, SAFE_SQUARES, trackSquare } from "./track";
import type { GameState, PlayerState } from "./types";

/**
 * The token a bot moves: a plain-spoken heuristic, deterministic so games replay. In order:
 * get a token home, cut the most advanced opponent token it can, bring a token out of the base,
 * move a token in danger to safety, then move the token furthest along that does not land in
 * danger (any token if all moves are risky).
 */
export function botMove(state: GameState): number | null {
  const { movable, roll } = state.turn;
  if (state.turn.phase !== "awaitingMove" || roll === null || movable.length === 0) return null;
  const me = state.players.find((p) => p.id === state.turn.playerId)!;
  const opponents = state.players.filter((p) => p.id !== me.id);
  const target = (i: number) => (me.tokens[i] === BASE ? 0 : me.tokens[i]! + roll);
  const safe = (progress: number) => {
    const sq = trackSquare(me.seat, progress);
    return sq === null || (state.rules.safeSquares && SAFE_SQUARES.has(sq));
  };
  const scored = movable.map((i) => {
    const to = target(i);
    const sq = trackSquare(me.seat, to);
    let score = 0;
    if (to === HOME) score += 1000;
    if (sq !== null && !safe(to)) {
      const cut = opponents.flatMap((o) => o.tokens.filter((t) => trackSquare(o.seat, t) === sq));
      if (cut.length > 0) score += 800 + Math.max(...cut);
    }
    if (me.tokens[i] === BASE) score += 600;
    const nowAtRisk = !safe(me.tokens[i]!) && threatened(me, me.tokens[i]!, opponents);
    const thenAtRisk = !safe(to) && threatened(me, to, opponents);
    if (nowAtRisk && !thenAtRisk) score += 400;
    if (thenAtRisk) score -= 300;
    score += to; // otherwise: the token furthest along
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored[0]!.i;
}

/** True when an opponent token sits 1-6 squares behind this progress on the shared track. */
function threatened(me: PlayerState, progress: number, opponents: PlayerState[]): boolean {
  const sq = trackSquare(me.seat, progress);
  if (sq === null) return false;
  return opponents.some((o) =>
    o.tokens.some((t) => {
      const from = trackSquare(o.seat, t);
      if (from === null) return false;
      const gap = (sq - from + 52) % 52;
      return gap >= 1 && gap <= 6;
    }),
  );
}
