import type { RngState } from "./rng";

export type PlayerId = string;

/** Ludo King classic by default. `blocks` and `playForPlaces` are unconfirmed against Ludo King. */
export interface RuleSet {
  /** a token leaves its base only on a 6 (off: any roll) */
  needSixToStart: boolean;
  /** a 6 gives another roll */
  sixAgain: boolean;
  /** with sixAgain, a third 6 in a row ends the turn without moving */
  threeSixesForfeit: boolean;
  /** cutting an opponent's token gives another roll */
  cutBonus: boolean;
  /** getting a token home gives another roll */
  homeBonus: boolean;
  /** nobody can be cut on a start or star square */
  safeSquares: boolean;
  /** two tokens of one colour on a square form a block nobody can land on or pass */
  blocks: boolean;
  /** keep playing after the first winner until one player is left */
  playForPlaces: boolean;
}

export const DEFAULT_RULES: RuleSet = {
  needSixToStart: true,
  sixAgain: true,
  threeSixesForfeit: true,
  cutBonus: true,
  homeBonus: true,
  safeSquares: true,
  blocks: false,
  playForPlaces: false,
};

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: string;
  /** board quadrant 0-3, clockwise; fixes the start square (seat * 13) */
  seat: number;
  isBot: boolean;
  /** each token's progress: -1 base, 0-50 shared track, 51-55 home column, 56 home */
  tokens: number[];
  finishedPlace?: number;
  resigned?: boolean;
}

export interface TurnState {
  playerId: PlayerId;
  phase: "awaitingRoll" | "awaitingMove" | "animating" | "gameOver";
  /** the roll waiting to be used (awaitingMove) */
  roll: number | null;
  /** 6s rolled in a row this turn */
  sixes: number;
  /** tokens the roll can move (awaitingMove) */
  movable: number[];
  /** set by the roll or move, used by ANIMATION_DONE: the same player rolls again */
  extraTurn: boolean;
}

export interface GameState {
  rules: RuleSet;
  players: PlayerState[];
  turn: TurnState;
  rng: RngState;
  log: GameEvent[];
}

export type Action =
  | { type: "ROLL"; playerId: PlayerId }
  | { type: "MOVE"; playerId: PlayerId; token: number }
  | { type: "ANIMATION_DONE" }
  | { type: "RESIGN"; playerId: PlayerId };

export type GameEvent =
  | { type: "ROLLED"; playerId: PlayerId; value: number }
  | { type: "NO_MOVE"; playerId: PlayerId; reason: "noMovable" | "threeSixes" }
  | { type: "ENTERED"; playerId: PlayerId; token: number }
  | { type: "MOVED"; playerId: PlayerId; token: number; from: number; to: number }
  | { type: "CUT"; playerId: PlayerId; token: number; victimId: PlayerId; victimToken: number; from: number }
  | { type: "HOME"; playerId: PlayerId; token: number }
  | { type: "EXTRA_TURN"; playerId: PlayerId; reason: "six" | "cut" | "home" }
  | { type: "RESIGNED"; playerId: PlayerId }
  | { type: "WON"; playerId: PlayerId; place: number }
  | { type: "GAME_OVER" };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  /** set when the action was rejected; the state is returned unchanged */
  error?: string;
}
