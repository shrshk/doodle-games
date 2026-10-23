import type { GameEvent, GameState, RuleSet } from "@snakes-doodle/engine";

export { PACE, turnPlaybackMs } from "./pace";

/** The one Colyseus room type. */
export const ROOM_NAME = "game";

/** Join codes skip look-alike characters (I, O, 0, 1) so they can be read out loud. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const isRoomCode = (s: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(s);
/** Codes are typed in by people: forgive case, spaces and dashes. */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Seats, in turn order. Same names as ui-doodle's TokenColor, which this package cannot import. */
export const SEATS = ["red", "yellow", "orange", "indigo"] as const;
export type Seat = (typeof SEATS)[number];
export const isSeat = (s: unknown): s is Seat => typeof s === "string" && (SEATS as readonly string[]).includes(s);
export const BOT_NAMES: Record<Seat, string> = { red: "Mush", yellow: "Bee", orange: "Owl", indigo: "Blob" };
export const NAME_MAX = 14;

export const TURN_SECONDS = { min: 5, max: 60, default: 20 };
export const RECONNECT_SECONDS = 120;
/** an empty room waits this long for someone to come back, then closes */
export const EMPTY_ROOM_SECONDS = 60;
/** time for every client to play the board's pop-up intro before the first roll */
export const INTRO_MS = 3500;

export interface CreateRoomOptions {
  /** an inbuilt board, or */
  boardId?: string;
  /** a custom board as JSON; the server parses and validates it */
  board?: unknown;
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

/**
 * Quick reactions: a fixed set of words instead of free chat, so anyone holding a room code can
 * cheer or groan but nobody can type anything unkind. The server relays them and stores nothing.
 */
export const REACTIONS = ["nice", "yay", "oops", "lucky", "noo", "gg"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (r: unknown): r is Reaction => typeof r === "string" && (REACTIONS as readonly string[]).includes(r);
export const REACTION_TEXT: Record<Reaction, string> = { nice: "nice!", yay: "yay!", oops: "oops!", lucky: "lucky!", noo: "nooo", gg: "gg" };
/** one reaction per player per this many ms; extras are dropped */
export const REACTION_COOLDOWN_MS = 1200;

/** Server -> client: someone in the room reacted. */
export interface ReactionMessage {
  playerId: string;
  reaction: Reaction;
}

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
