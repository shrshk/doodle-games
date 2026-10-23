import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { classic100 } from "@snakes-doodle/boards";
import { ROOM_NAME, isRoomCode, type RoomView, type TurnMessage } from "@snakes-doodle/protocol";
import { createGameServer } from "../src/app";
import { GameRoom, REAL_TIMING } from "../src/rooms/GameRoom";

// Turns take milliseconds here: no intro, no playback wait, a 5 "second" timer that lasts 50 ms.
const FAST = { introMs: 0, playbackScale: 0, secondMs: 10, botThinkMinMs: 5, botThinkMaxMs: 10, awayRollMs: 5, emptyRoomMs: 100 };

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  GameRoom.timing = FAST;
  colyseus = await boot(createGameServer());
});
afterAll(async () => {
  GameRoom.timing = REAL_TIMING;
  await colyseus.shutdown();
});
afterEach(async () => colyseus.cleanup());

const view = (room: { state: unknown }) => (room.state as { toJSON(): RoomView }).toJSON();
/** close code for a lost connection; 4000 would mean the player left on purpose */
const NETWORK_DROP = 4500;
/** create a room and wait until its first state has arrived */
const create = async (options: Record<string, unknown>) => {
  const room = await colyseus.sdk.create(ROOM_NAME, options);
  await room.waitForInitialState();
  return room;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Poll until check() holds; a check that throws (state not synced yet) counts as not yet. */
const until = async (check: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  const holds = () => {
    try {
      return check();
    } catch {
      return false;
    }
  };
  while (!holds()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await sleep(5);
  }
};

/** Host creates a room by code, a friend joins it by that code. */
async function twoPlayerRoom(createOptions: Record<string, unknown> = {}) {
  const host = await create({ name: "Ana", ...createOptions });
  const friend = await colyseus.sdk.joinById(host.roomId, { name: "Bo" });
  await friend.waitForInitialState();
  const room = colyseus.getRoomById<GameRoom>(host.roomId);
  await until(() => view(host).turnOrder.length === 2 && view(friend).turnOrder.length === 2);
  return { host, friend, room };
}

describe("GameRoom", () => {
  it("opens under a six-character code that a friend can join, seating them in turn order", async () => {
    const { host, friend } = await twoPlayerRoom();
    expect(isRoomCode(host.roomId)).toBe(true);
    const v = view(friend);
    expect(v.code).toBe(host.roomId);
    expect(v.hostId).toBe(host.sessionId);
    expect(v.turnOrder).toEqual([host.sessionId, friend.sessionId]);
    expect(Object.values(v.players).map((p) => [p.name, p.color])).toEqual([
      ["Ana", "red"],
      ["Bo", "yellow"],
    ]);
    expect(JSON.parse(v.boardJson).id).toBe("classic-100");
  });

  it("only lets the host add bots and start, and needs two players", async () => {
    const host = await create({ name: "Ana" });
    host.send("start");
    await sleep(40);
    expect(view(host).phase).toBe("lobby");

    const friend = await colyseus.sdk.joinById(host.roomId, { name: "Bo" });
    await friend.waitForInitialState();
    await until(() => view(host).turnOrder.length === 2);
    friend.send("addBot", { seat: "orange" });
    friend.send("start");
    await sleep(40);
    expect(view(host).turnOrder).toHaveLength(2);
    expect(view(host).phase).toBe("lobby");

    host.send("addBot", { seat: "orange" });
    await until(() => view(host).turnOrder.length === 3);
    expect(view(host).players["bot-orange"]).toMatchObject({ isBot: true, name: "Owl" });
    host.send("start");
    await until(() => view(friend).phase === "playing");
  });

  it("rejects a roll out of turn and plays the one in turn on the server's dice", async () => {
    const { host, friend } = await twoPlayerRoom({ turnSeconds: 60 });
    const turns: TurnMessage[] = [];
    host.onMessage("turn", (m: TurnMessage) => turns.push(m));
    host.send("start");
    await until(() => view(host).phase === "playing");

    friend.send("roll");
    await sleep(60);
    expect(turns).toHaveLength(0);

    host.send("roll");
    await until(() => turns.length === 1);
    const rolled = turns[0]!.events.find((e) => e.type === "ROLLED");
    expect(rolled).toMatchObject({ playerId: host.sessionId });
    expect(turns[0]!.game).not.toHaveProperty("rng");
    // a roll that is not a six hands the turn over
    const value = (rolled as { value: number }).value;
    expect(turns[0]!.game.turn.playerId).toBe(value === 6 ? host.sessionId : friend.sessionId);
  });

  it("rolls for a player whose turn timer runs out", async () => {
    const { host } = await twoPlayerRoom({ turnSeconds: 5 });
    const turns: TurnMessage[] = [];
    host.onMessage("turn", (m: TurnMessage) => turns.push(m));
    host.send("start");
    // nobody rolls: 5 "seconds" of 10 ms later the server does it
    await until(() => turns.length >= 1, 1000);
    expect(turns[0]!.events[0]).toMatchObject({ type: "ROLLED", playerId: host.sessionId });
  });

  it("can skip instead of roll when the room says so", async () => {
    const { host } = await twoPlayerRoom({ turnSeconds: 5, onTimeout: "skip" });
    const turns: TurnMessage[] = [];
    host.onMessage("turn", (m: TurnMessage) => turns.push(m));
    host.send("start");
    await until(() => turns.length >= 1, 1000);
    expect(turns[0]!.events).toEqual([{ type: "TURN_SKIPPED", playerId: host.sessionId }]);
  });

  it("keeps a dropped player's seat and gives it back when they reconnect", async () => {
    const { host, friend, room } = await twoPlayerRoom({ turnSeconds: 60 });
    host.send("start");
    await until(() => view(host).phase === "playing");
    const token = friend.reconnectionToken;
    const seat = friend.sessionId;

    // an unexpected drop, and the SDK must not quietly reconnect by itself before we do
    friend.reconnection.enabled = false;
    friend.connection.close(NETWORK_DROP, "network");
    await until(() => room.state.players.get(seat)?.connected === false);
    expect(view(host).turnOrder).toContain(seat);

    const back = await colyseus.sdk.reconnect(token);
    expect(back.sessionId).toBe(seat);
    await until(() => room.state.players.get(seat)?.connected === true);
  });

  it("plays a whole game with bots and a player who is away, to the finish", async () => {
    const { host } = await twoPlayerRoom({ boardId: "quick-doodle", turnSeconds: 5 });
    host.send("addBot", { seat: "orange" });
    await until(() => view(host).turnOrder.length === 3);
    host.send("start");
    await until(() => view(host).phase === "playing");
    // the host walks away: the server keeps rolling for them (the friend stays, but never rolls)
    host.reconnection.enabled = false;
    host.connection.close(NETWORK_DROP, "network");
    const room = colyseus.getRoomById<GameRoom>(host.roomId);
    await until(() => room.state.phase === "finished", 10000);
    const places = [...room.state.players.values()].map((p) => p.place);
    expect(places).toContain(1);
  });

  it("closes a room once everyone has left and nobody comes back", async () => {
    const host = await create({ name: "Ana" });
    const code = host.roomId;
    await host.leave();
    expect(colyseus.getRoomById(code)).toBeDefined();
    await until(() => !colyseus.getRoomById(code), 2000);
    await expect(colyseus.sdk.joinById(code)).rejects.toThrow();
  });

  it("accepts a valid custom board and refuses a broken one", async () => {
    const custom = { ...classic100, id: "my-board", name: "My board" };
    const ok = await create({ name: "Ana", board: custom });
    await until(() => view(ok).boardId === "my-board");

    // a snake whose head is on a ladder foot breaks the board
    const broken = { ...custom, snakes: [...custom.snakes, { from: custom.ladders[0]!.from + 0, to: 2 }] };
    await expect(colyseus.sdk.create(ROOM_NAME, { board: broken })).rejects.toThrow(/board_invalid/);
    await expect(colyseus.sdk.create(ROOM_NAME, { board: { nonsense: true } })).rejects.toThrow(/board_invalid_json/);
    await expect(colyseus.sdk.create(ROOM_NAME, { boardId: "nope" })).rejects.toThrow(/board_unknown/);
  });

  it("goes back to the lobby after a game, keeping seats and bots", async () => {
    const host = await create({ name: "Ana", boardId: "quick-doodle" });
    host.send("addBot", { seat: "yellow" });
    await until(() => view(host).turnOrder.length === 2);
    host.send("start");
    // the host never rolls, so the timer does: a full game in well under the limit
    await until(() => view(host).phase === "finished", 15000);
    host.send("lobby");
    await until(() => view(host).phase === "lobby");
    expect(Object.values(view(host).players).every((p) => p.position === 0 && p.place === 0)).toBe(true);
    expect(view(host).turnOrder).toHaveLength(2);
  });
});
