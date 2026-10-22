import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@snakes-doodle/engine";
import { DEFAULT_SLOTS, loadSetup, saveSetup } from "./setup";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
});

afterEach(() => store.clear());

describe("remembered setup", () => {
  it("defaults to Classic 100, the usual rules and the default players", () => {
    const s = loadSetup();
    expect(s.board.id).toBe("classic-100");
    expect(s.rules).toEqual(DEFAULT_RULES);
    expect(s.slots).toEqual(DEFAULT_SLOTS);
    expect(s.theme).toBe("day");
  });

  it("round-trips the board, rules and players", () => {
    const first = loadSetup();
    const board = { ...first.board, id: "snake-pit" };
    saveSetup({
      board,
      rules: { ...DEFAULT_RULES, overshoot: "bounce", startOnSix: true },
      slots: first.slots.map((s) => ({ ...s, kind: "bot" as const })),
      theme: "night",
    });
    const back = loadSetup();
    expect(back.board.id).toBe("snake-pit");
    expect(back.rules.overshoot).toBe("bounce");
    expect(back.rules.startOnSix).toBe(true);
    expect(back.slots.every((s) => s.kind === "bot")).toBe(true);
    expect(back.theme).toBe("night");
  });

  it("survives junk: unknown board, bad rule values, short or broken player lists", () => {
    store.set("snakes-doodle:setup", JSON.stringify({ boardId: "nope", rules: { overshoot: "fly", sixRule: "yes" }, slots: [{ kind: "wizard", name: 7 }] }));
    const s = loadSetup();
    expect(s.board.id).toBe("classic-100");
    expect(s.rules).toEqual(DEFAULT_RULES);
    expect(s.slots[0]).toEqual(DEFAULT_SLOTS[0]);
    store.set("snakes-doodle:setup", "{not json");
    expect(loadSetup().board.id).toBe("classic-100");
  });
});
