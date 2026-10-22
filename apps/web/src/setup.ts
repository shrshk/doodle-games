// The last-used board, house rules and players, remembered per device in localStorage.
// Reads tolerate missing, old or hand-edited data and blocked storage (private windows).

import { classic100, inbuiltBoards, type Board } from "@snakes-doodle/boards";
import { DEFAULT_RULES, type RuleSet } from "@snakes-doodle/engine";
import { TOKEN_COLORS, type TokenColor } from "@snakes-doodle/ui-doodle";

const KEY = "snakes-doodle:setup";

export type SlotKind = "human" | "bot" | "off";

export interface Slot {
  color: TokenColor;
  kind: SlotKind;
  name: string;
}

export type Theme = "day" | "night";

export interface Setup {
  board: Board;
  rules: RuleSet;
  slots: Slot[];
  theme: Theme;
}

export const DEFAULT_SLOTS: Slot[] = [
  { color: "red", kind: "human", name: "Mush" },
  { color: "yellow", kind: "bot", name: "Bee" },
  { color: "orange", kind: "off", name: "Owl" },
  { color: "indigo", kind: "off", name: "Blob" },
];

export function boardById(id: unknown): Board {
  return inbuiltBoards.find((b) => b.id === id) ?? classic100;
}

function readRules(raw: unknown): RuleSet {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof RuleSet) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_RULES[k] as boolean));
  return {
    chainJumps: bool("chainJumps"),
    overshoot: r.overshoot === "bounce" ? "bounce" : "stay",
    sixRule: bool("sixRule"),
    startOnSix: bool("startOnSix"),
    playForPlaces: bool("playForPlaces"),
  };
}

function readSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return DEFAULT_SLOTS;
  return DEFAULT_SLOTS.map((fallback, i) => {
    const s = raw[i] as Partial<Slot> | undefined;
    const kind: SlotKind = s?.kind === "human" || s?.kind === "bot" || s?.kind === "off" ? s.kind : fallback.kind;
    const name = typeof s?.name === "string" ? s.name.slice(0, 12) : fallback.name;
    const color = TOKEN_COLORS.includes(s?.color as TokenColor) ? (s!.color as TokenColor) : fallback.color;
    return { color, kind, name };
  });
}

export function loadSetup(): Setup {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    return {
      board: boardById(raw.boardId),
      rules: readRules(raw.rules),
      slots: readSlots(raw.slots),
      theme: raw.theme === "night" ? "night" : "day",
    };
  } catch {
    return { board: classic100, rules: { ...DEFAULT_RULES }, slots: DEFAULT_SLOTS, theme: "day" };
  }
}

export function saveSetup({ board, rules, slots, theme }: Setup) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ boardId: board.id, rules, slots, theme }));
  } catch {
    // storage blocked: the choices last for this visit only
  }
}
