import type { Reaction, Seat } from "@doodle-games/rooms";
import type { GameEvent, GameState, RuleSet } from "@ludo-doodle/engine";

export { PACE, stepPlaybackMs } from "./pace";
export {
  BOT_NAMES,
  CODE_LENGTH,
  NAME_MAX,
  REACTIONS,
  REACTION_TEXT,
  SEATS,
  TURN_SECONDS,
  isReaction,
  isRoomCode,
  isSeat,
  normalizeCode,
  type Reaction,
  type ReactionMessage,
  type Seat,
} from "@doodle-games/rooms";

/** The Colyseus room type (Snakes & Ladders' is "game", so both can live on one server). */
export const ROOM_NAME = "ludo";

/** time for every client to play the board's intro before the first roll */
export const INTRO_MS = 2500;

export interface CreateRoomOptions {
  rules?: Partial<RuleSet>;
  turnSeconds?: number;
  name?: string;
  seat?: Seat;
}

export interface JoinRoomOptions {
  name?: string;
  seat?: Seat;
}

/** The engine state every player may see: no RNG (it would reveal future rolls), no log. */
export type PublicGame = Omit<GameState, "rng" | "log">;

export const publicGame = ({ rng: _rng, log: _log, ...rest }: GameState): PublicGame => rest;

/** Server -> client, once per game: the starting state, with the board intro about to play. */
export interface StartedMessage {
  game: PublicGame;
  seq: number;
  /** ms from now until the first roll is allowed */
  actInMs: number;
}

/**
 * Server -> client, once per step of a turn: a roll (with the move, when it was the only one), or
 * a picked move. What happened, the state after it, and when the next roll or pick opens.
 */
export interface StepMessage {
  events: GameEvent[];
  game: PublicGame;
  seq: number;
  actInMs: number;
  /** ms from now until the timer for that roll or pick runs out (0 when the game is over) */
  deadlineInMs: number;
}

/** Client -> server message types. */
export type ClientMessage =
  | { type: "roll" }
  | { type: "move"; token: number }
  | { type: "react"; reaction: Reaction }
  | { type: "seat"; seat: Seat }
  | { type: "name"; name: string }
  | { type: "addBot"; seat: Seat }
  | { type: "removeBot"; seat: Seat }
  | { type: "start" }
  | { type: "lobby" };

/** The synced room state as plain JSON (what `state.toJSON()` gives on the client). */
export interface RoomPlayer {
  id: string;
  name: string;
  color: Seat;
  connected: boolean;
  isBot: boolean;
  place: number;
}

export interface RoomView {
  phase: "lobby" | "playing" | "finished";
  code: string;
  hostId: string;
  rulesJson: string;
  players: Record<string, RoomPlayer>;
  turnOrder: string[];
  currentPlayerId: string;
  /** the PublicGame after the last step, so a tab that comes back mid-game can redraw the board */
  gameJson: string;
  /** epoch ms on the server clock */
  turnDeadline: number;
  turnSeconds: number;
  spectators: number;
}

export type { GameEvent };
