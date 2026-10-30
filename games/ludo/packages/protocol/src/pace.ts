import type { GameEvent } from "@ludo-doodle/engine";

/**
 * Every animation timing in one place (ms). The web client plays each step at this pace, and the
 * online server uses the same numbers to know when a step has finished playing on screen.
 */
export const PACE = {
  /** the die's run down the dice tower (matches TOWER_MS in ui-doodle) */
  diceTumble: 1350,
  afterDice: 350,
  /** one movable token: it goes by itself after this */
  autoMove: 350,
  hopPerSquare: 240,
  afterLanding: 260,
  enter: 560,
  cutFly: 800,
  home: 700,
  noMove: 1000,
  extraTurn: 750,
  handoff: 950,
  beforeWin: 700,
  botThinkMin: 700,
  botThinkMax: 1200,
  botPick: 650,
};

/**
 * How long a client takes to play one step's events at full motion, plus the hand-over when the
 * turn passes to someone else. Mirrors the client's playback; it errs short, since a client also
 * waits for its own animation to finish before it lets anyone act.
 */
export function stepPlaybackMs(events: GameEvent[], handoff: boolean): number {
  let ms = 0;
  let afterRoll = false;
  for (const e of events) {
    switch (e.type) {
      case "ROLLED":
        ms += PACE.diceTumble + PACE.afterDice;
        break;
      case "ENTERED":
        ms += (afterRoll ? PACE.autoMove : 0) + PACE.enter + PACE.afterLanding;
        break;
      case "MOVED":
        ms += (afterRoll ? PACE.autoMove : 0) + (e.to - e.from) * PACE.hopPerSquare + PACE.afterLanding;
        break;
      case "CUT":
        ms += PACE.cutFly;
        break;
      case "HOME":
        ms += PACE.home;
        break;
      case "NO_MOVE":
        ms += PACE.noMove;
        break;
      case "EXTRA_TURN":
        ms += PACE.extraTurn;
        break;
      case "GAME_OVER":
        ms += PACE.beforeWin;
        break;
      case "WON":
      case "RESIGNED":
        break;
    }
    afterRoll = e.type === "ROLLED";
  }
  return ms + (handoff ? PACE.handoff : 0);
}
