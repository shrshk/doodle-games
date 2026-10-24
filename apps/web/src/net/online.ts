import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME, type CreateRoomOptions, type JoinRoomOptions, type RoomView } from "@snakes-doodle/protocol";

// The Colyseus client adapter: opening, joining and resuming rooms. The store owns what happens
// inside a room; this file only knows how to reach one.

/**
 * The game server. Production serves the page and the game from one origin; the Vite dev server
 * runs beside the game server on :2567. VITE_SERVER_URL overrides both.
 */
export function serverUrl(): string {
  const override = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (override) return override;
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:2567`;
  return location.origin;
}

let client: Client | null = null;
const getClient = () => (client ??= new Client(serverUrl()));

export type GameRoom = Room<any, { toJSON(): RoomView }>;

// A refresh keeps the seat: the reconnection token lives for the tab's session only.
const RESUME_KEY = "snakes-doodle:room";

export function rememberRoom(room: GameRoom) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ token: room.reconnectionToken, code: room.roomId }));
  } catch {
    // storage blocked (private mode): a refresh simply leaves the room
  }
}

export function forgetRoom() {
  try {
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // nothing stored, nothing to forget
  }
}

/** The room this tab is seated in (survives a refresh or a pasted link), if any. */
export const savedRoomCode = () => savedRoom()?.code ?? null;

function savedRoom(): { token: string; code: string } | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? "null") as { token?: unknown; code?: unknown } | null;
    return typeof raw?.token === "string" && typeof raw.code === "string" ? { token: raw.token, code: raw.code } : null;
  } catch {
    return null;
  }
}

export const createRoom = (options: CreateRoomOptions) => getClient().create(ROOM_NAME, options) as Promise<GameRoom>;

export const joinRoom = (code: string, options: JoinRoomOptions) => getClient().joinById(code, options) as Promise<GameRoom>;

/** Back into the room this tab was in before a refresh, if the server still holds the seat. */
export async function resumeRoom(): Promise<GameRoom | null> {
  const saved = savedRoom();
  if (!saved) return null;
  try {
    return (await getClient().reconnect(saved.token)) as GameRoom;
  } catch {
    forgetRoom();
    return null;
  }
}

/**
 * Turn a matchmaking failure into words. The SDK's MatchMakeError carries a `code`: 522 is a room
 * that does not exist (or closed), a plain HTTP 404 means this page was not served by a game server
 * (an old install from another address), and a failed fetch means the server is unreachable.
 */
export function describeError(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown };
  const msg = typeof e?.message === "string" ? e.message : String(err);
  if (e?.code === 522 || /not found/i.test(msg) && /room/i.test(msg)) return "no room with that code (it may have closed)";
  if (e?.code === 404) return `there's no game server at ${location.host}: open the game from the server's address`;
  if (/locked|full/i.test(msg)) return "that room is full";
  if (/board/.test(msg)) return "the server did not accept that board";
  if (e?.code === "ECONNREFUSED" || /fetch|network|Failed|Load failed/i.test(msg)) return "can't reach the game server";
  return "something went wrong, try again";
}

/** /join/ABC123 opens the app straight into that room. */
export function codeFromPath(path = location.pathname): string | null {
  const m = /^\/join\/([A-Za-z0-9-]{4,12})\/?$/.exec(path);
  return m ? m[1]! : null;
}

export const joinLink = (code: string) => `${location.origin}/join/${code}`;
