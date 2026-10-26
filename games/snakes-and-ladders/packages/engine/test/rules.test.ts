import { describe, expect, it } from "vitest";
import { classic100 } from "@snakes-doodle/boards";
import { createGame, reduce } from "../src";
import { DONE, ROLL, makeBoard, newGame, place, run } from "./helpers";

const pos = (s: { players: { id: string; position: number }[] }, id: string) =>
  s.players.find((p) => p.id === id)!.position;

describe("createGame", () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: "x", color: "red" }));

  it("starts every token off-board with player one to roll", () => {
    const g = createGame({ board: classic100, players: players(4), seed: 1 });
    expect(g.players.map((p) => p.position)).toEqual([0, 0, 0, 0]);
    expect(g.turn).toMatchObject({ playerId: "p0", phase: "awaitingRoll", consecutiveSixes: 0 });
    expect(g.track.finalSquare).toBe(100);
  });

  it("accepts 2-4 players only", () => {
    expect(() => createGame({ board: classic100, players: players(1), seed: 1 })).toThrow();
    expect(() => createGame({ board: classic100, players: players(5), seed: 1 })).toThrow();
  });

  it("rejects duplicate ids and invalid boards", () => {
    const dup = [players(1)[0]!, players(1)[0]!];
    expect(() => createGame({ board: classic100, players: dup, seed: 1 })).toThrow(/unique/);
    expect(() => createGame({ board: makeBoard([[5, 9]]), players: players(2), seed: 1 })).toThrow(/invalid board/);
  });
});

describe("moving", () => {
  it("moves forward by the roll and waits for the animation", () => {
    const { state, events } = run(newGame(makeBoard(), [4]), ROLL("p1"));
    expect(events).toEqual([
      { type: "ROLLED", playerId: "p1", value: 4 },
      { type: "MOVED", playerId: "p1", from: 0, to: 4, path: [1, 2, 3, 4] },
    ]);
    expect(pos(state, "p1")).toBe(4);
    expect(state.turn.phase).toBe("animating");
    expect(run(state, DONE).state.turn).toMatchObject({ playerId: "p2", phase: "awaitingRoll" });
  });

  it("lets tokens share a square", () => {
    const { state } = run(newGame(makeBoard(), [3, 3]), ROLL("p1"), DONE, ROLL("p2"));
    expect(pos(state, "p1")).toBe(3);
    expect(pos(state, "p2")).toBe(3);
  });

  it("climbs a ladder and slides down a snake", () => {
    const board = makeBoard([[14, 2]], [[3, 10]]);
    const up = run(newGame(board, [3]), ROLL("p1"));
    expect(up.events[2]).toEqual({ type: "LADDER", playerId: "p1", from: 3, to: 10 });
    expect(pos(up.state, "p1")).toBe(10);

    const down = run(place(newGame(board, [4]), { p1: 10 }), ROLL("p1"));
    expect(down.events[2]).toEqual({ type: "SNAKE", playerId: "p1", from: 14, to: 2 });
    expect(pos(down.state, "p1")).toBe(2);
  });

  it("does not chain jumps unless chainJumps is on", () => {
    const board = makeBoard([[6, 2]], [[3, 6]]);
    expect(pos(run(newGame(board, [3]), ROLL("p1")).state, "p1")).toBe(6);
    const chained = run(newGame(board, [3], { rules: { chainJumps: true } }), ROLL("p1"));
    expect(chained.events.map((e) => e.type)).toEqual(["ROLLED", "MOVED", "LADDER", "SNAKE"]);
    expect(pos(chained.state, "p1")).toBe(2);
  });
});

describe("finishing", () => {
  it("needs an exact roll; overshoot forfeits the move by default", () => {
    const { state, events } = run(place(newGame(makeBoard(), [5]), { p1: 14 }), ROLL("p1"));
    expect(events[1]).toEqual({ type: "BLOCKED", playerId: "p1", reason: "overshoot" });
    expect(pos(state, "p1")).toBe(14);
  });

  it("bounces back the excess when overshoot is bounce", () => {
    const g = place(newGame(makeBoard(), [5], { rules: { overshoot: "bounce" } }), { p1: 14 });
    const { state, events } = run(g, ROLL("p1"));
    expect(events[1]).toEqual({ type: "MOVED", playerId: "p1", from: 14, to: 13, path: [15, 16, 15, 14, 13] });
    expect(pos(state, "p1")).toBe(13);
  });

  it("applies a snake on the bounce landing square", () => {
    const g = place(newGame(makeBoard([[13, 4]]), [5], { rules: { overshoot: "bounce" } }), { p1: 14 });
    expect(pos(run(g, ROLL("p1")).state, "p1")).toBe(4);
  });

  it("wins on the final square and ends the game", () => {
    const { state, events } = run(place(newGame(makeBoard(), [2]), { p1: 14 }), ROLL("p1"));
    expect(events.slice(-2)).toEqual([{ type: "WON", playerId: "p1", place: 1 }, { type: "GAME_OVER" }]);
    expect(state.turn.phase).toBe("gameOver");
    expect(reduce(state, DONE).error).toBe("not_animating");
    expect(reduce(state, ROLL("p2")).error).toBe("not_awaiting_roll");
  });

  it("plays for places until one player is left", () => {
    const g = place(newGame(makeBoard(), [2, 1, 2], { players: 3, rules: { playForPlaces: true } }), {
      p1: 14,
      p2: 1,
      p3: 14,
    });
    const first = run(g, ROLL("p1"));
    expect(first.events.at(-1)).toEqual({ type: "WON", playerId: "p1", place: 1 });
    expect(first.state.turn.phase).toBe("animating");

    const end = run(first.state, DONE, ROLL("p2"), DONE, ROLL("p3"));
    expect(end.events.slice(-3)).toEqual([
      { type: "WON", playerId: "p3", place: 2 },
      { type: "WON", playerId: "p2", place: 3 },
      { type: "GAME_OVER" },
    ]);
  });

  it("skips finished players when passing the turn", () => {
    const g = place(newGame(makeBoard(), [2, 1, 1], { players: 3, rules: { playForPlaces: true } }), { p1: 14 });
    const { state } = run(g, ROLL("p1"), DONE, ROLL("p2"), DONE, ROLL("p3"), DONE);
    expect(state.turn.playerId).toBe("p2");
  });
});

describe("sixes", () => {
  it("grants another roll on a 6", () => {
    const { state, events } = run(newGame(classic100, [6]), ROLL("p1"));
    expect(events.at(-1)).toEqual({ type: "EXTRA_TURN", playerId: "p1" });
    expect(run(state, DONE).state.turn).toMatchObject({ playerId: "p1", consecutiveSixes: 1, phase: "awaitingRoll" });
  });

  it("forfeits the whole turn on a third 6", () => {
    // 0 -> 6 -> 12; the third 6 sends the token back to where the turn began
    const g = place(newGame(classic100, [6, 6, 6]), { p1: 0 });
    const two = run(g, ROLL("p1"), DONE, ROLL("p1"), DONE);
    expect(pos(two.state, "p1")).toBe(12);
    const third = run(two.state, ROLL("p1"));
    expect(third.events).toEqual([
      { type: "ROLLED", playerId: "p1", value: 6 },
      { type: "TURN_FORFEITED", playerId: "p1", to: 0 },
    ]);
    expect(pos(third.state, "p1")).toBe(0);
    expect(run(third.state, DONE).state.turn).toMatchObject({ playerId: "p2", consecutiveSixes: 0 });
  });

  it("treats 6 as an ordinary roll when sixRule is off", () => {
    const { state, events } = run(newGame(classic100, [6], { rules: { sixRule: false } }), ROLL("p1"));
    expect(events.map((e) => e.type)).toEqual(["ROLLED", "MOVED"]);
    expect(run(state, DONE).state.turn.playerId).toBe("p2");
  });

  it("needs a 6 to enter when startOnSix is on, then enters on square 1", () => {
    const g = newGame(makeBoard(), [3, 2, 6], { rules: { startOnSix: true } });
    const blocked = run(g, ROLL("p1"));
    expect(blocked.events[1]).toEqual({ type: "BLOCKED", playerId: "p1", reason: "needSix" });
    const entered = run(blocked.state, DONE, ROLL("p2"), DONE, ROLL("p1"));
    expect(entered.events[1]).toEqual({ type: "MOVED", playerId: "p1", from: 0, to: 1, path: [1] });
    expect(entered.events.at(-1)).toEqual({ type: "EXTRA_TURN", playerId: "p1" });
  });
});

describe("turn control", () => {
  it("rejects out-of-turn and mid-animation actions without changing state", () => {
    const g = newGame(makeBoard(), [2]);
    expect(reduce(g, ROLL("p2"))).toEqual({ state: g, events: [], error: "not_your_turn" });
    expect(reduce(g, DONE).error).toBe("not_animating");
    const rolled = run(g, ROLL("p1")).state;
    expect(reduce(rolled, ROLL("p1")).error).toBe("not_awaiting_roll");
    expect(reduce(rolled, { type: "SKIP_TURN", playerId: "p1" }).error).toBe("not_awaiting_roll");
  });

  it("skips a turn", () => {
    const { state, events } = run(newGame(makeBoard(), [2]), { type: "SKIP_TURN", playerId: "p1" });
    expect(events).toEqual([{ type: "TURN_SKIPPED", playerId: "p1" }]);
    expect(state.turn).toMatchObject({ playerId: "p2", phase: "awaitingRoll" });
  });

  it("ends a two-player game when one resigns", () => {
    const { state, events } = run(newGame(makeBoard(), [2]), { type: "RESIGN", playerId: "p2" });
    expect(events).toEqual([
      { type: "RESIGNED", playerId: "p2" },
      { type: "WON", playerId: "p1", place: 1 },
      { type: "GAME_OVER" },
    ]);
    expect(state.turn.phase).toBe("gameOver");
  });

  it("passes the turn on when the current player resigns", () => {
    const g = newGame(makeBoard(), [2], { players: 3 });
    const { state } = run(g, { type: "RESIGN", playerId: "p1" });
    expect(state.turn).toMatchObject({ playerId: "p2", phase: "awaitingRoll" });
    expect(reduce(state, { type: "RESIGN", playerId: "p1" }).error).toBe("player_not_active");
  });

  it("skips a player who resigned mid-animation", () => {
    const g = newGame(makeBoard(), [2], { players: 3 });
    const { state } = run(g, ROLL("p1"), { type: "RESIGN", playerId: "p2" }, DONE);
    expect(state.turn.playerId).toBe("p3");
  });

  it("never mutates its input", () => {
    const g = newGame(makeBoard(), [4]);
    const snapshot = JSON.parse(JSON.stringify(g)) as typeof g;
    run(g, ROLL("p1"), DONE);
    expect(g).toEqual(snapshot);
  });

  it("appends every event to the log", () => {
    const { state } = run(newGame(makeBoard(), [4, 2]), ROLL("p1"), DONE, ROLL("p2"));
    expect(state.log.map((e) => e.type)).toEqual(["ROLLED", "MOVED", "ROLLED", "MOVED"]);
  });
});
