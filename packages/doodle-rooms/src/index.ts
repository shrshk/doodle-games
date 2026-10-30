// What every game's online rooms share, safe to import in the browser: room codes, seats, names,
// timings and quick reactions. Server-only helpers live in "@doodle-games/rooms/server".

/** Join codes skip look-alike characters (I, O, 0, 1) so they can be read out loud. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const isRoomCode = (s: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(s);
/** Codes are typed in by people: forgive case, spaces and dashes. */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Seats, in turn order. Same names as ui-doodle's TokenColor, which server code cannot import. */
export const SEATS = ["red", "yellow", "orange", "indigo"] as const;
export type Seat = (typeof SEATS)[number];
export const isSeat = (s: unknown): s is Seat => typeof s === "string" && (SEATS as readonly string[]).includes(s);
export const BOT_NAMES: Record<Seat, string> = { red: "Mush", yellow: "Bee", orange: "Owl", indigo: "Blob" };
export const NAME_MAX = 14;

export const TURN_SECONDS = { min: 5, max: 60, default: 20 };
export const RECONNECT_SECONDS = 120;
/** an empty room waits this long for someone to come back, then closes */
export const EMPTY_ROOM_SECONDS = 60;

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
