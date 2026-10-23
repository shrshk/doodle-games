import { squareToCell, type Board } from "@snakes-doodle/boards";
import type { GameEvent } from "@snakes-doodle/engine";

/**
 * Every animation timing in one place (ms). The web client plays turns at this pace, and the
 * online server uses the same numbers to know when a turn has finished playing on screen.
 */
export const PACE = {
  /** the die's run down the dice tower (matches TOWER_MS in ui-doodle) */
  diceTumble: 1350,
  afterDice: 450,
  beforeHop: 300,
  hopPerSquare: 330,
  afterLanding: 380,
  rung: 230,
  chomp: 700,
  digestMin: 1700,
  digestPerCell: 230,
  spit: 650,
  forfeitJump: 650,
  blocked: 1100,
  extraTurn: 900,
  handoff: 1100,
  beforeWin: 700,
  botThinkMin: 900,
  botThinkMax: 1500,
};

/** Straight-line distance in cells between two squares' centres (ladders and snakes are drawn on it). */
function cellDistance(board: Board, a: number, b: number): number {
  const ca = squareToCell(board.grid, a);
  const cb = squareToCell(board.grid, b);
  return Math.hypot(ca.col - cb.col, ca.row - cb.row) || 1;
}

/**
 * How long a client takes to play these events at full motion, including the hand-over to the
 * next player. Mirrors the client's playback; it errs short, since a client also waits for its own
 * animation to finish before it lets anyone roll.
 */
export function turnPlaybackMs(events: GameEvent[], board: Board): number {
  let ms = 0;
  for (const e of events) {
    switch (e.type) {
      case "ROLLED":
        ms += PACE.diceTumble + PACE.afterDice;
        break;
      case "MOVED":
        ms += PACE.beforeHop + e.path.length * PACE.hopPerSquare + PACE.afterLanding;
        break;
      case "LADDER": {
        const rungs = Math.max(2, Math.floor(cellDistance(board, e.from, e.to) / 0.36));
        ms += (rungs + 1) * PACE.rung + PACE.afterLanding;
        break;
      }
      case "SNAKE":
        ms += PACE.chomp + Math.max(PACE.digestMin, cellDistance(board, e.from, e.to) * PACE.digestPerCell) + PACE.spit + PACE.afterLanding;
        break;
      case "BLOCKED":
        ms += PACE.blocked;
        break;
      case "EXTRA_TURN":
        ms += PACE.extraTurn;
        break;
      case "TURN_FORFEITED":
        ms += PACE.forfeitJump;
        break;
      case "WON":
        ms += PACE.beforeWin;
        break;
      case "TURN_SKIPPED":
      case "RESIGNED":
      case "GAME_OVER":
        break;
    }
  }
  return ms + PACE.handoff;
}
