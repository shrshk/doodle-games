import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { BASE, HOME, type GameState } from "@ludo-doodle/engine";
import { ROOM_NAME, isRoomCode, type ReactionMessage, type RoomView, type StepMessage } from "@ludo-doodle/protocol";
import { createLudoServer } from "../src/app";
import { DEFAULT_LIMITS, LudoRoom, REAL_TIMING, resetRateLimits } from "../src/rooms/LudoRoom";

// Steps take milliseconds here: no intro, no playback wait, a 5 "second" timer that lasts 50 ms.
const FAST = { introMs: 0, playbackScale: 0, secondMs: 10, botThinkMinMs: 5, botThinkMaxMs: 10, botPickMs: 5, awayActMs: 5, emptyRoomMs: 100 };

let colyseus: ColyseusTestServer;
// the suite opens dozens of rooms from one address in seconds: limits are lifted except where tested
const RELAXED = { joinsPerMinute: 10_000, maxRooms: 10_000, messagesPerSecond: 1_000 };

beforeAll(async () => {
  LudoRoom.timing = FAST;
  LudoRoom.limits = RELAXED;
  // a port of its own: both games' suites run at once, and boot() would always take 2568 (the Ludo
  // dev server's port) for a ready-made Server, whatever port it is given
  const server = createLudoServer();
  await server.listen(2579);
  colyseus = new ColyseusTestServer(server);
});
afterAll(async () => {
  LudoRoom.timing = REAL_TIMING;
  LudoRoom.limits = DEFAULT_LIMITS;
  await colyseus.shutdown();
});
afterEach(async () => colyseus.cleanup());

const view = (room: { state: unknown }) => (room.state as { toJSON(): RoomView }).toJSON();
/** close code for a lost connection; 4000 would mean the player left on purpose */
const NETWORK_DROP = 4500;
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

async function twoPlayerRoom(createOptions: Record<string, unknown> = {}) {
  const host = await create({ name: "Ana", ...createOptions });
  const friend = await colyseus.sdk.joinById(host.roomId, { name: "Bo" });
  await friend.waitForInitialState();
  const room = colyseus.getRoomById<LudoRoom>(host.roomId);
  await until(() => view(host).turnOrder.length === 2 && view(friend).turnOrder.length === 2);
  return { host, friend, room };
}

/** Puts the tokens where a test needs them, mid-game, without touching the server's dice. */
function placeTokens(room: LudoRoom, tokens: Record<string, number[]>) {
  const r = room as unknown as { game: GameState };
  r.game = { ...r.game, players: r.game.players.map((p) => (tokens[p.id] ? { ...p, tokens: tokens[p.id]! } : p)) };
}

describe("LudoRoom", () => {
  it("opens under a six-character code; the second player sits opposite the first", async () => {
    const { host, friend } = await twoPlayerRoom();
    expect(isRoomCode(host.roomId)).toBe(true);
    const v = view(friend);
    expect(v.code).toBe(host.roomId);
    expect(v.hostId).toBe(host.sessionId);
    expect(v.turnOrder).toEqual([host.sessionId, friend.sessionId]);
    expect(Object.values(v.players).map((p) => [p.name, p.color])).toEqual([
      ["Ana", "red"],
      ["Bo", "orange"],
    ]);
  });

  it("takes house rules from the creator and keeps Ludo King's for the rest", async () => {
    const host = await create({ name: "Ana", rules: { needSixToStart: false, blocks: "yes" } });
    const rules = JSON.parse(view(host).rulesJson);
    expect(rules).toMatchObject({ needSixToStart: false, blocks: false, sixAgain: true, safeSquares: true });
  });

  it("only lets the host add bots and start, and needs two players", async () => {
    const host = await create({ name: "Ana" });
    host.send("start");
    await sleep(40);
    expect(view(host).phase).toBe("lobby");

    const friend = await colyseus.sdk.joinById(host.roomId, { name: "Bo" });
    await friend.waitForInitialState();
    await until(() => view(host).turnOrder.length === 2);
    friend.send("addBot", { seat: "yellow" });
    friend.send("start");
    await sleep(40);
    expect(view(host).turnOrder).toHaveLength(2);
    expect(view(host).phase).toBe("lobby");

    host.send("addBot", { seat: "yellow" });
    await until(() => view(host).turnOrder.length === 3);
    expect(view(host).players["bot-yellow"]).toMatchObject({ isBot: true, name: "Bee" });
    host.send("start");
    await until(() => view(friend).phase === "playing");
    expect(JSON.parse(view(friend).gameJson).players.map((p: { seat: number }) => p.seat)).toEqual([0, 1, 2]);
  });

  it("a roll with a real choice waits for the player's pick, and only a legal pick by them counts", async () => {
    const { host, friend, room } = await twoPlayerRoom({ turnSeconds: 60 });
    const steps: StepMessage[] = [];
    host.onMessage("step", (m: StepMessage) => steps.push(m));
    host.send("start");
    await until(() => room.state.phase === "playing");
    // any roll can move either of two tokens, to different squares
    placeTokens(room, { [host.sessionId]: [10, 20, HOME, HOME] });

    friend.send("roll");
    await sleep(60);
    expect(steps).toHaveLength(0);

    host.send("roll");
    await until(() => steps.length === 1);
    expect(steps[0]!.events).toEqual([{ type: "ROLLED", playerId: host.sessionId, value: expect.any(Number) }]);
    expect(steps[0]!.game.turn).toMatchObject({ phase: "awaitingMove", movable: [0, 1] });
    expect(steps[0]!.game).not.toHaveProperty("rng");

    friend.send("move", { token: 1 });
    await sleep(320); // past the per-client cooldown
    host.send("move", { token: 3 }); // already home
    await sleep(60);
    expect(steps).toHaveLength(1);

    await sleep(320);
    host.send("move", { token: 1 });
    await until(() => steps.length === 2);
    const value = (steps[0]!.events[0] as { value: number }).value;
    expect(steps[1]!.events[0]).toEqual({ type: "MOVED", playerId: host.sessionId, token: 1, from: 20, to: 20 + value });
  });

  it("a roll with only one possible move plays it in the same step", async () => {
    const { host, room } = await twoPlayerRoom({ turnSeconds: 60 });
    const steps: StepMessage[] = [];
    host.onMessage("step", (m: StepMessage) => steps.push(m));
    host.send("start");
    await until(() => room.state.phase === "playing");
    placeTokens(room, { [host.sessionId]: [10, HOME, HOME, HOME] });
    host.send("roll");
    await until(() => steps.length === 1);
    expect(steps[0]!.events.map((e) => e.type).slice(0, 2)).toEqual(["ROLLED", "MOVED"]);
    expect(steps[0]!.game.turn.phase).toBe("awaitingRoll");
  });

  it("when the timer runs out it rolls for the player, then picks for them", async () => {
    const { host, room } = await twoPlayerRoom({ turnSeconds: 20 });
    const steps: StepMessage[] = [];
    host.onMessage("step", (m: StepMessage) => steps.push(m));
    host.send("start");
    await until(() => room.state.phase === "playing");
    placeTokens(room, { [host.sessionId]: [10, 20, HOME, HOME] });
    // nobody acts: 20 "seconds" of 10 ms later the server rolls, and 20 more later it moves
    await until(() => steps.length >= 2, 1000);
    expect(steps[0]!.events[0]).toMatchObject({ type: "ROLLED", playerId: host.sessionId });
    expect(steps[1]!.events[0]).toMatchObject({ type: "MOVED", playerId: host.sessionId });
  });

  it("keeps a dropped player's seat and gives it back when they reconnect", async () => {
    const { host, friend, room } = await twoPlayerRoom({ turnSeconds: 60 });
    host.send("start");
    await until(() => view(host).phase === "playing");
    const token = friend.reconnectionToken;
    const seat = friend.sessionId;

    friend.reconnection.enabled = false;
    friend.connection.close(NETWORK_DROP, "network");
    await until(() => room.state.players.get(seat)?.connected === false);
    expect(view(host).turnOrder).toContain(seat);

    const back = await colyseus.sdk.reconnect(token);
    expect(back.sessionId).toBe(seat);
    await until(() => room.state.players.get(seat)?.connected === true);
    // the board comes back with it: the synced game names every seat
    await until(() => typeof view(back).gameJson === "string" && view(back).gameJson.length > 0);
    expect(JSON.parse(view(back).gameJson).players.map((p: { id: string }) => p.id)).toContain(seat);
  });

  it("plays a whole game with a bot and a player who is away, to the finish, then back to the lobby", async () => {
    // the host never acts either: a 2 ms timer "second" keeps the whole game to a few seconds
    LudoRoom.timing = { ...FAST, secondMs: 2 };
    const { host, friend, room } = await twoPlayerRoom({ turnSeconds: 5, rules: { needSixToStart: false } });
    host.send("addBot", { seat: "yellow" });
    await until(() => view(host).turnOrder.length === 3);
    host.send("start");
    await until(() => view(host).phase === "playing");
    // the friend walks away: the server keeps playing for them (the host stays, but never acts)
    friend.reconnection.enabled = false;
    friend.connection.close(NETWORK_DROP, "network");
    await until(() => room.state.phase === "finished", 60000);
    const game = JSON.parse(room.state.gameJson) as GameState;
    const winner = game.players.find((p) => p.finishedPlace === 1)!;
    expect(winner.tokens).toEqual([HOME, HOME, HOME, HOME]);
    expect(game.players.flatMap((p) => p.tokens).every((t) => t >= BASE && t <= HOME)).toBe(true);
    expect(room.state.players.get(winner.id)?.place).toBe(1);

    host.send("lobby");
    await until(() => view(host).phase === "lobby");
    // the friend who left for good frees their seat; the bot stays
    expect(view(host).turnOrder).toEqual([host.sessionId, "bot-yellow"]);
    expect(Object.values(view(host).players).every((p) => p.place === 0)).toBe(true);
    expect(view(host).gameJson).toBe("");
    LudoRoom.timing = FAST;
  }, 70000);

  it("relays known reactions from seated players, at most one per cooldown", async () => {
    const { host, friend } = await twoPlayerRoom();
    const seen: ReactionMessage[] = [];
    friend.onMessage("reaction", (m: ReactionMessage) => seen.push(m));
    host.send("react", { reaction: "yay" });
    host.send("react", { reaction: "gg" }); // too soon: dropped
    host.send("react", { reaction: "you stink" }); // not on the list: dropped
    await until(() => seen.length === 1);
    await sleep(80);
    expect(seen).toEqual([{ playerId: host.sessionId, reaction: "yay" }]);
  });

  it("limits how often one address can open or join rooms", async () => {
    resetRateLimits();
    LudoRoom.limits = { ...RELAXED, joinsPerMinute: 3 };
    try {
      const host = await create({ name: "Ana" });
      await colyseus.sdk.joinById(host.roomId, { name: "Bo" });
      await create({ name: "Cy" });
      await expect(colyseus.sdk.create(ROOM_NAME, { name: "Di" })).rejects.toThrow(/too_many_requests/);
    } finally {
      LudoRoom.limits = RELAXED;
      resetRateLimits();
    }
  });

  it("refuses new rooms once the server holds its maximum", async () => {
    await create({ name: "Ana" });
    await create({ name: "Bo" });
    LudoRoom.limits = { ...RELAXED, maxRooms: 2 };
    try {
      await expect(colyseus.sdk.create(ROOM_NAME, { name: "Cy" })).rejects.toThrow(/server_busy/);
    } finally {
      LudoRoom.limits = RELAXED;
    }
  });

  it("closes a room once everyone has left and nobody comes back", async () => {
    const host = await create({ name: "Ana" });
    const code = host.roomId;
    await host.leave();
    expect(colyseus.getRoomById(code)).toBeDefined();
    await until(() => !colyseus.getRoomById(code), 2000);
    await expect(colyseus.sdk.joinById(code)).rejects.toThrow();
  });
});
