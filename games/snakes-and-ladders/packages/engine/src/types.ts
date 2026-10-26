import type { RngState } from "./rng";

export type PlayerId = string;

export interface RuleSet {
  /** A jump that lands on another snake head or ladder foot keeps going. */
  chainJumps: boolean;
  /** Overshooting the final square: "stay" forfeits the move, "bounce" walks back the excess. */
  overshoot: "stay" | "bounce";
  /** A 6 grants another roll; a third 6 in a row forfeits the whole turn. */
  sixRule: boolean;
  /** A token needs a 6 to enter the board (it enters on square 1). */
  startOnSix: boolean;
  /** Keep playing after the first winner until one player is left. */
  playForPlaces: boolean;
}

export const DEFAULT_RULES: RuleSet = {
  chainJumps: false,
  overshoot: "stay",
  sixRule: true,
  startOnSix: false,
  playForPlaces: false,
};

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: string;
  /** 0 = off-board */
  position: number;
  isBot: boolean;
  finishedPlace?: number;
  resigned?: boolean;
}

export interface TurnState {
  playerId: PlayerId;
  consecutiveSixes: number;
  phase: "awaitingRoll" | "animating" | "gameOver";
  /** Square the token stood on when this turn began; a three-sixes forfeit returns it here. */
  startPosition: number;
  /** Set by ROLL, consumed by ANIMATION_DONE. */
  extraTurn: boolean;
}

/** The parts of the board the rules need, copied in so a GameState replays on its own. */
export interface Track {
  finalSquare: number;
  /** snake head / ladder foot -> destination */
  jumps: Record<number, number>;
}

export interface GameState {
  boardId: string;
  rules: RuleSet;
  track: Track;
  players: PlayerState[];
  turn: TurnState;
  rng: RngState;
  log: GameEvent[];
}

export type Action =
  | { type: "ROLL"; playerId: PlayerId }
  | { type: "ANIMATION_DONE" }
  | { type: "SKIP_TURN"; playerId: PlayerId }
  | { type: "RESIGN"; playerId: PlayerId };

export type GameEvent =
  | { type: "ROLLED"; playerId: PlayerId; value: number }
  | { type: "MOVED"; playerId: PlayerId; from: number; to: number; path: number[] }
  | { type: "LADDER"; playerId: PlayerId; from: number; to: number }
  | { type: "SNAKE"; playerId: PlayerId; from: number; to: number }
  | { type: "BLOCKED"; playerId: PlayerId; reason: "overshoot" | "needSix" }
  | { type: "EXTRA_TURN"; playerId: PlayerId }
  | { type: "TURN_FORFEITED"; playerId: PlayerId; to: number }
  | { type: "TURN_SKIPPED"; playerId: PlayerId }
  | { type: "RESIGNED"; playerId: PlayerId }
  | { type: "WON"; playerId: PlayerId; place: number }
  | { type: "GAME_OVER" };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  /** Set when the action was rejected; state is returned unchanged. */
  error?: string;
}
