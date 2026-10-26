import { schema, t, type SchemaType } from "@colyseus/schema";

// Mirrors RoomView in @snakes-doodle/protocol, which is what clients read via state.toJSON().
// The engine's RNG seed and log never go in here: the seed would let a client predict rolls.

export const PlayerState = schema(
  {
    id: t.string(),
    name: t.string(),
    color: t.string(),
    position: t.uint8().default(0),
    connected: t.boolean().default(true),
    isBot: t.boolean().default(false),
    place: t.uint8().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const GameRoomState = schema(
  {
    phase: t.string().default("lobby"),
    code: t.string(),
    hostId: t.string().default(""),
    boardId: t.string(),
    /** the full board, sent once on join */
    boardJson: t.string(),
    rulesJson: t.string(),
    players: t.map(PlayerState),
    turnOrder: t.array("string"),
    currentPlayerId: t.string().default(""),
    lastRoll: t.uint8().default(0),
    /** epoch ms, for the turn timer */
    turnDeadline: t.number().default(0),
    turnSeconds: t.uint8().default(20),
    spectators: t.uint8().default(0),
  },
  "GameRoomState",
);
export type GameRoomState = SchemaType<typeof GameRoomState>;
