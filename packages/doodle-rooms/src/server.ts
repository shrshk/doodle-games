// Server-side helpers every game's Colyseus room shares: room codes that are unique across all
// games on one server, abuse limits counted per server (not per game), name cleaning, logging and
// serving the built web client.
import { randomInt } from "node:crypto";
import { ServerError, type AuthContext, type Presence } from "@colyseus/core";
import { CODE_ALPHABET, CODE_LENGTH, NAME_MAX } from "./index";

export { redirects, serveStatic } from "./static";

/** One JSON line per room event, so a host machine's log shows who joined, dropped and came back. */
export function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

/** Any thrown error in onCreate fails the create call; the client sees this message. */
export class RoomOptionsError extends Error {}

export function cleanName(raw: unknown, fallback: string): string {
  const name = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, NAME_MAX) : "";
  return name || fallback;
}

// ---------- room codes ----------

/** one set for every game, so two rooms on one server never share a code (it is the room id) */
const CODES_KEY = "doodle-games:codes";

/** A short code that doubles as the room id, unique across the whole server. */
export async function claimCode(presence: Presence): Promise<string> {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    // check, then claim: the local presence's sadd returns nothing, so it cannot report a clash
    if (await presence.sismember(CODES_KEY, code)) continue;
    await presence.sadd(CODES_KEY, code);
    return code;
  }
}

export const releaseCode = (presence: Presence, code: string) => presence.srem(CODES_KEY, code);

// ---------- abuse limits ----------

/**
 * Abuse limits. A volumetric flood is Cloudflare's job (the tunnel puts its proxy in front of the
 * Air); these stop what gets through from eating the process: scripted room spam and message floods.
 */
export interface RoomLimits {
  /** room creations + joins per client address per minute */
  joinsPerMinute: number;
  /** rooms open at once on this server, all games together */
  maxRooms: number;
  /** messages per client per second; Colyseus disconnects a client that sends more */
  messagesPerSecond: number;
}

export const DEFAULT_LIMITS: RoomLimits = { joinsPerMinute: 30, maxRooms: 200, messagesPerSecond: 20 };

/** recent matchmaking calls per client address (sliding one-minute window) */
const recentJoins = new Map<string, number[]>();
let openRooms = 0;

/** Tests start each limit check from a clean slate. */
export function resetRateLimits() {
  recentJoins.clear();
}

/** The player's address: Cloudflare's header when the tunnel is in front, else what Colyseus saw. */
function clientAddress(context: AuthContext): string {
  const cf = context.headers?.get?.("cf-connecting-ip");
  return cf || context.ip || "unknown";
}

/** For a room's onAuth (every create and join, not reconnects): throws 429 past the per-address limit. */
export function checkJoinRate(context: AuthContext, limits: RoomLimits) {
  const ip = clientAddress(context);
  const now = Date.now();
  const recent = (recentJoins.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= limits.joinsPerMinute) {
    log("rate_limited", { ip });
    throw new ServerError(429, "too_many_requests");
  }
  recent.push(now);
  recentJoins.set(ip, recent);
  // keep the map from growing without bound under a spray of addresses
  if (recentJoins.size > 10_000) {
    for (const [key, times] of recentJoins) if (now - times[times.length - 1]! > 60_000) recentJoins.delete(key);
  }
}

/** For a room's onCreate: counts the room, or throws when the server is full. */
export function openRoom(limits: RoomLimits) {
  if (openRooms >= limits.maxRooms) {
    log("room_cap_reached", { openRooms });
    throw new RoomOptionsError("server_busy");
  }
  openRooms++;
}

/** For a room's onDispose, after a successful openRoom. */
export function closeRoom() {
  openRooms--;
}
