// Every snake on a board picks a kind by its `style` index, so snakes differ in shape and
// pattern, not just colour.

export type Pattern = "bands" | "spots" | "zigzag" | "diamonds" | "rings" | "chevrons" | "blotches" | "belly";
export type HeadShape = "round" | "arrow" | "hood";
export type Accessory = "none" | "bow" | "crown" | "leaf" | "partyhat";
export type Tail = "point" | "curl" | "rattle";

export interface SnakeKind {
  fill: string;
  stroke: string;
  accent: string;
  pattern: Pattern;
  head: HeadShape;
  accessory: Accessory;
  tail: Tail;
  lashes: boolean;
  /** body half-width at the neck, in cells */
  width: number;
  /** more or fewer curves than the default */
  waveScale: number;
}

export const SNAKE_KINDS: readonly SnakeKind[] = [
  { fill: "#82B86A", stroke: "#4E7F3E", accent: "#5F8F4A", pattern: "bands", head: "round", accessory: "leaf", tail: "curl", lashes: false, width: 0.2, waveScale: 1 },
  { fill: "#E87D6D", stroke: "#A23C34", accent: "#FFF4EC", pattern: "spots", head: "round", accessory: "bow", tail: "point", lashes: true, width: 0.22, waveScale: 0.8 },
  { fill: "#7F98D8", stroke: "#2F3088", accent: "#3E3F9E", pattern: "zigzag", head: "arrow", accessory: "none", tail: "point", lashes: false, width: 0.16, waveScale: 1.35 },
  { fill: "#EDB763", stroke: "#A8682A", accent: "#C9772A", pattern: "diamonds", head: "arrow", accessory: "none", tail: "rattle", lashes: false, width: 0.24, waveScale: 0.9 },
  { fill: "#AB88D4", stroke: "#5E3F8A", accent: "#7E5BB0", pattern: "rings", head: "hood", accessory: "crown", tail: "point", lashes: false, width: 0.19, waveScale: 1.1 },
  { fill: "#6CC0B0", stroke: "#2F7A6E", accent: "#2F7A6E", pattern: "chevrons", head: "round", accessory: "none", tail: "curl", lashes: true, width: 0.17, waveScale: 1.25 },
  { fill: "#C99F6C", stroke: "#7A5530", accent: "#9C6B3C", pattern: "blotches", head: "arrow", accessory: "none", tail: "point", lashes: false, width: 0.27, waveScale: 0.7 },
  { fill: "#B5CF55", stroke: "#6B7F2A", accent: "#F6F2D8", pattern: "belly", head: "round", accessory: "partyhat", tail: "point", lashes: false, width: 0.19, waveScale: 1 },
];

export const kindOf = (style: number) => SNAKE_KINDS[((style % SNAKE_KINDS.length) + SNAKE_KINDS.length) % SNAKE_KINDS.length]!;
