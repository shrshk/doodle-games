// The last-used house rules and players, remembered per device in localStorage.
// Reads tolerate missing, old or hand-edited data and blocked storage (private windows).

import { DEFAULT_RULES, type RuleSet } from "@ludo-doodle/engine";
import type { TokenColor } from "@doodle-games/ui-doodle";

const KEY = "ludo-doodle:setup";

export type SlotKind = "human" | "bot" | "off";

/** One of the four corners of the board; slot i always sits at seat i. */
export interface Slot {
  color: TokenColor;
  kind: SlotKind;
  name: string;
}

export interface Setup {
  rules: RuleSet;
  slots: Slot[];
}

/** Seats clockwise from the top-left. Two players sit opposite (red and orange), as in Ludo King. */
export const DEFAULT_SLOTS: Slot[] = [
  { color: "red", kind: "human", name: "Mush" },
  { color: "yellow", kind: "off", name: "Bee" },
  { color: "orange", kind: "bot", name: "Owl" },
  { color: "indigo", kind: "off", name: "Blob" },
];

export function readRules(raw: unknown): RuleSet {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(DEFAULT_RULES) as (keyof RuleSet)[]) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  return out;
}

export function readSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return DEFAULT_SLOTS;
  return DEFAULT_SLOTS.map((fallback, i) => {
    const s = raw[i] as Partial<Slot> | undefined;
    const kind: SlotKind = s?.kind === "human" || s?.kind === "bot" || s?.kind === "off" ? s.kind : fallback.kind;
    const name = typeof s?.name === "string" ? s.name.slice(0, 12) : fallback.name;
    // a seat's colour is fixed by its corner of the board
    return { color: fallback.color, kind, name };
  });
}

export function loadSetup(): Setup {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    return { rules: readRules(raw.rules), slots: readSlots(raw.slots) };
  } catch {
    return { rules: { ...DEFAULT_RULES }, slots: DEFAULT_SLOTS };
  }
}

export function saveSetup({ rules, slots }: Setup) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ rules, slots }));
  } catch {
    // storage blocked: the choices last for this visit only
  }
}
