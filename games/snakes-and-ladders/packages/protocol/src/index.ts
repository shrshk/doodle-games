import type { Seat, Reaction } from "@doodle-games/rooms";
import type { GameEvent, GameState, RuleSet } from "@snakes-doodle/engine";

export { PACE, turnPlaybackMs } from "./pace";

/** The one Colyseus room type. */
export const ROOM_NAME = "game";

export {
  BOT_NAMES,
  CODE_ALPHABET,
  CODE_LENGTH,
  EMPTY_ROOM_SECONDS,
  NAME_MAX,
  RECONNECT_SECONDS,
  SEATS,
  TURN_SECONDS,
  isRoomCode,
  isSeat,
  normalizeCode,
  type Seat,
} from "@doodle-games/rooms";
/** time for every client to play the board's pop-up intro before the first roll */
export const INTRO_MS = 3500;

export interface CreateRoomOptions {
  /** an inbuilt board's id (default classic-100) */
  boardId?: string;
  rules?: Partial<RuleSet>;
  turnSeconds?: number;
  /** when a turn timer runs out: roll for the player (default) or skip them */
  onTimeout?: "roll" | "skip";
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
  rollInMs: number;
}

/** Server -> client, once per turn: what happened, the state after it, and when to roll next. */
export interface TurnMessage {
  events: GameEvent[];
  game: PublicGame;
  seq: number;
  rollInMs: number;
  /** ms from now until the turn timer runs out (0 when the game is over) */
  deadlineInMs: number;
}

export { REACTIONS, REACTION_COOLDOWN_MS, REACTION_TEXT, isReaction, type Reaction, type ReactionMessage } from "@doodle-games/rooms";

/** Client -> server message types. */
export type ClientMessage =
  | { type: "roll" }
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
  position: number;
  connected: boolean;
  isBot: boolean;
  place: number;
}

export interface RoomView {
  phase: "lobby" | "playing" | "finished";
  code: string;
  hostId: string;
  boardId: string;
  boardJson: string;
  rulesJson: string;
  players: Record<string, RoomPlayer>;
  turnOrder: string[];
  currentPlayerId: string;
  lastRoll: number;
  /** epoch ms on the server clock */
  turnDeadline: number;
  turnSeconds: number;
  spectators: number;
}
