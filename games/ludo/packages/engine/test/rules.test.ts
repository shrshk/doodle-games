import { describe, expect, it } from "vitest";
import { BASE, HOME, createGame, reduce, trackSquare } from "../src";
import { run, setup, tokensOf } from "./helpers";

const roll = (playerId: string) => ({ type: "ROLL" as const, playerId });
const move = (playerId: string, token: number) => ({ type: "MOVE" as const, playerId, token });
const done = { type: "ANIMATION_DONE" as const };

describe("leaving the base", () => {
  it("takes a 6: anything else passes the turn", () => {
    const r = run(setup({ rolls: [5] }), roll("p0"));
    expect(r.events).toEqual([
      { type: "ROLLED", playerId: "p0", value: 5 },
      { type: "NO_MOVE", playerId: "p0", reason: "noMovable" },
    ]);
    expect(run(r.state, done).state.turn.playerId).toBe("p2");
  });

  it("on a 6 any of the four can come out, onto the start square, and the 6 rolls again", () => {
    const r1 = run(setup({ rolls: [6] }), roll("p0"));
    expect(r1.state.turn.movable).toEqual([0, 1, 2, 3]);
    const r2 = run(r1.state, move("p0", 2));
    expect(r2.events).toEqual([
      { type: "ENTERED", playerId: "p0", token: 2 },
      { type: "EXTRA_TURN", playerId: "p0", reason: "six" },
    ]);
    expect(tokensOf(r2.state, "p0")).toEqual([BASE, BASE, 0, BASE]);
    expect(run(r2.state, done).state.turn).toMatchObject({ playerId: "p0", phase: "awaitingRoll" });
  });

  it("with needSixToStart off, any roll brings a token out", () => {
    const r = run(setup({ rolls: [3], rules: { needSixToStart: false } }), roll("p0"));
    expect(r.state.turn.movable).toEqual([0, 1, 2, 3]);
  });
});

describe("getting home", () => {
  it("needs an exact roll: a token that would overshoot cannot move", () => {
    const r = run(setup({ tokens: { p0: [53, BASE, BASE, BASE] }, rolls: [4] }), roll("p0"));
    expect(r.events.at(-1)).toEqual({ type: "NO_MOVE", playerId: "p0", reason: "noMovable" });
  });

  it("an exact roll gets it home and gives another roll", () => {
    const r = run(setup({ tokens: { p0: [53, BASE, BASE, BASE] }, rolls: [3] }), roll("p0"), move("p0", 0));
    expect(r.events).toEqual([
      { type: "MOVED", playerId: "p0", token: 0, from: 53, to: HOME },
      { type: "HOME", playerId: "p0", token: 0 },
      { type: "EXTRA_TURN", playerId: "p0", reason: "home" },
    ]);
  });

  it("the last token home wins and ends the game", () => {
    const r = run(setup({ tokens: { p0: [HOME, HOME, HOME, 55] }, rolls: [1] }), roll("p0"), move("p0", 3));
    expect(r.events.slice(-2)).toEqual([{ type: "WON", playerId: "p0", place: 1 }, { type: "GAME_OVER" }]);
    expect(r.state.turn.phase).toBe("gameOver");
  });

  it("with playForPlaces the others play on until one is left", () => {
    const s = setup({ seats: [0, 1, 2], tokens: { p0: [HOME, HOME, HOME, 55] }, rolls: [1], rules: { playForPlaces: true } });
    const r = run(s, roll("p0"), move("p0", 3));
    expect(r.events.at(-1)).toEqual({ type: "WON", playerId: "p0", place: 1 });
    expect(run(r.state, done).state.turn).toMatchObject({ playerId: "p1", phase: "awaitingRoll" });
  });
});

describe("cutting", () => {
  // p0 starts on square 0, p2 on square 26: p2's progress 30 is square (26 + 30) % 52 = 4
  it("landing on an opponent sends it home and gives another roll", () => {
    const s = setup({ tokens: { p0: [1, BASE, BASE, BASE], p2: [30, BASE, BASE, BASE] }, rolls: [3] });
    expect(trackSquare(2, 30)).toBe(4);
    const r = run(s, roll("p0"), move("p0", 0));
    expect(r.events).toEqual([
      { type: "MOVED", playerId: "p0", token: 0, from: 1, to: 4 },
      { type: "CUT", playerId: "p0", token: 0, victimId: "p2", victimToken: 0, from: 30 },
      { type: "EXTRA_TURN", playerId: "p0", reason: "cut" },
    ]);
    expect(tokensOf(r.state, "p2")).toEqual([BASE, BASE, BASE, BASE]);
  });

  it("nobody is cut on a star square: both stay", () => {
    // square 8 is the star after p0's start; p2 reaches it at progress (8 - 26 + 52) = 34
    const s = setup({ tokens: { p0: [5, BASE, BASE, BASE], p2: [34, BASE, BASE, BASE] }, rolls: [3] });
    const r = run(s, roll("p0"), move("p0", 0));
    expect(r.events.map((e) => e.type)).toEqual(["MOVED"]);
    expect(tokensOf(r.state, "p2")[0]).toBe(34);
  });

  it("nobody is cut on a start square, even by its owner's opponent", () => {
    // p2's start is square 26 = p0's progress 26
    const s = setup({ tokens: { p0: [22, BASE, BASE, BASE], p2: [0, BASE, BASE, BASE] }, rolls: [4] });
    const r = run(s, roll("p0"), move("p0", 0));
    expect(r.events.map((e) => e.type)).not.toContain("CUT");
  });

  it("with safeSquares off, the star square is no shelter", () => {
    const s = setup({ tokens: { p0: [5, BASE, BASE, BASE], p2: [34, BASE, BASE, BASE] }, rolls: [3], rules: { safeSquares: false } });
    expect(run(s, roll("p0"), move("p0", 0)).events.map((e) => e.type)).toContain("CUT");
  });

  it("tokens in a home column are out of reach", () => {
    // p0 lands on square 4; a p2 token in its home column (progress 52) is not on the shared track
    const s = setup({ tokens: { p0: [1, BASE, BASE, BASE], p2: [52, BASE, BASE, BASE] }, rolls: [3] });
    const r = run(s, roll("p0"), move("p0", 0));
    expect(tokensOf(r.state, "p2")[0]).toBe(52);
  });

  it("two opponent tokens on one square are both cut (no blocks)", () => {
    const s = setup({ tokens: { p0: [1, BASE, BASE, BASE], p2: [30, 30, BASE, BASE] }, rolls: [3] });
    const r = run(s, roll("p0"), move("p0", 0));
    expect(r.events.filter((e) => e.type === "CUT")).toHaveLength(2);
  });

  it("with blocks on, an opponent's double cannot be landed on or passed", () => {
    const s = setup({ tokens: { p0: [1, BASE, BASE, BASE], p2: [30, 30, BASE, BASE] }, rolls: [5], rules: { blocks: true } });
    const r = run(s, roll("p0"));
    expect(r.events.at(-1)).toEqual({ type: "NO_MOVE", playerId: "p0", reason: "noMovable" });
  });
});

describe("sixes", () => {
  it("a third 6 in a row ends the turn without moving", () => {
    const s = setup({ tokens: { p0: [10, BASE, BASE, BASE] }, rolls: [6, 6, 6] });
    const r = run(s, roll("p0"), move("p0", 0), done, roll("p0"), move("p0", 0), done, roll("p0"));
    expect(r.events).toEqual([
      { type: "ROLLED", playerId: "p0", value: 6 },
      { type: "NO_MOVE", playerId: "p0", reason: "threeSixes" },
    ]);
    expect(run(r.state, done).state.turn.playerId).toBe("p2");
  });

  it("a 6 that cannot move still rolls again", () => {
    const s = setup({ tokens: { p0: [HOME, HOME, HOME, 54] }, rolls: [6] });
    const r = run(s, roll("p0"));
    expect(r.events.slice(-2)).toEqual([
      { type: "NO_MOVE", playerId: "p0", reason: "noMovable" },
      { type: "EXTRA_TURN", playerId: "p0", reason: "six" },
    ]);
    expect(run(r.state, done).state.turn.playerId).toBe("p0");
  });

  it("the count of sixes starts again after a non-6", () => {
    const s = setup({ tokens: { p0: [10, BASE, BASE, BASE] }, rolls: [6, 6, 2] });
    const r = run(s, roll("p0"), move("p0", 0), done, roll("p0"), move("p0", 0), done, roll("p0"));
    expect(r.state.turn.sixes).toBe(0);
  });
});

describe("turns", () => {
  it("go clockwise by seat, whatever order the players joined in", () => {
    const g = createGame({
      players: [
        { id: "c", name: "C", color: "orange", seat: 2 },
        { id: "a", name: "A", color: "red", seat: 0 },
        { id: "b", name: "B", color: "yellow", seat: 1 },
      ],
      seed: 1,
    });
    expect(g.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(g.turn.playerId).toBe("a");
  });

  it("reject rolling out of turn and moving a token the roll cannot move", () => {
    const s = setup({ tokens: { p0: [10, BASE, BASE, BASE] }, rolls: [3] });
    expect(reduce(s, roll("p2")).error).toBe("not_your_turn");
    const r = run(s, roll("p0"));
    expect(reduce(r.state, move("p0", 1)).error).toBe("token_cannot_move");
  });

  it("a resigning player's opponent wins when only one is left", () => {
    const r = run(setup({}), { type: "RESIGN", playerId: "p2" });
    expect(r.events).toEqual([
      { type: "RESIGNED", playerId: "p2" },
      { type: "WON", playerId: "p0", place: 1 },
      { type: "GAME_OVER" },
    ]);
  });
});
