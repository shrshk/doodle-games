import { schema, t, type SchemaType } from "@colyseus/schema";

// Mirrors RoomView in @ludo-doodle/protocol, which is what clients read via state.toJSON().
// The engine's RNG seed and log never go in here: the seed would let a client predict rolls.

export const PlayerState = schema(
  {
    id: t.string(),
    name: t.string(),
    color: t.string(),
    connected: t.boolean().default(true),
    isBot: t.boolean().default(false),
    place: t.uint8().default(0),
  },
  "LudoPlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const LudoRoomState = schema(
  {
    phase: t.string().default("lobby"),
    code: t.string(),
    hostId: t.string().default(""),
    rulesJson: t.string(),
    players: t.map(PlayerState),
    turnOrder: t.array("string"),
    currentPlayerId: t.string().default(""),
    /** the public game after the last step (tokens, turn, roll), for tabs that come back mid-game */
    gameJson: t.string().default(""),
    /** epoch ms, for the turn timer */
    turnDeadline: t.number().default(0),
    turnSeconds: t.uint8().default(20),
    spectators: t.uint8().default(0),
  },
  "LudoRoomState",
);
export type LudoRoomState = SchemaType<typeof LudoRoomState>;
