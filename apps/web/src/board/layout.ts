import type { Pt, Quad } from "./projection";

export type Orientation = "landscape" | "portrait";

interface Placed extends Pt {
  s: number;
}

export type Critter = "ladybug" | "snail" | "butterfly" | "dandelion" | "coffee-stain" | "hill-house";

export interface PlacedCritter extends Placed {
  kind: Critter;
}

/** Where everything sits on the sheet, per orientation. Units are SVG viewBox units. */
export interface SheetLayout {
  orientation: Orientation;
  width: number;
  height: number;
  /** stroke-weight multiplier: phones draw the board smaller, so lines need more ink */
  ink: number;
  quad: Quad;
  dice: Placed;
  diceLabel: Pt;
  roster: { x: number; y: number; width: number; rowH: number };
  notes: Pt;
  title: Pt;
  caption: Pt;
  whale: Placed | null;
  sun: Placed | null;
  clouds: Placed[];
  rainbow: Placed | null;
  bunting: { x: number; y: number; width: number } | null;
  /** top-bar controls drawn on the sheet */
  speaker: Placed;
  /** day / night switch, next to the speaker */
  themeToggle: Placed;
  homeLink: Pt;
  /** "start" sits left of the waiting tokens when there is margin there, else to their right */
  startLabelLeft: boolean;
  potatoes: Placed[];
  grass: Pt[];
  flowers: Pt[];
  mushrooms: Pt[];
  critters: PlacedCritter[];
}

const P = (x: number, y: number): Pt => ({ x, y });
const S = (x: number, y: number, s: number): Placed => ({ x, y, s });
const C = (kind: Critter, x: number, y: number, s = 1): PlacedCritter => ({ kind, x, y, s });

export const LANDSCAPE: SheetLayout = {
  orientation: "landscape",
  width: 1600,
  height: 1000,
  ink: 1.1,
  quad: [P(448, 34), P(1152, 34), P(1212, 902), P(388, 902)],
  dice: S(1405, 555, 0.8),
  diceLabel: P(1405, 712),
  roster: { x: 1262, y: 128, width: 300, rowH: 66 },
  notes: P(1405, 412),
  title: P(800, 455),
  caption: P(1395, 968),
  whale: S(1420, 845, 0.72),
  sun: S(115, 150, 0.85),
  clouds: [S(285, 280, 0.95)],
  rainbow: S(185, 770, 1.0),
  // over the side margin, not over the board
  bunting: { x: 30, y: -6, width: 340 },
  potatoes: [S(318, 868, 0.85), S(1268, 912, 0.9)],
  grass: [P(500, 33), P(690, 32), P(985, 32), P(1120, 33), P(60, 950), P(195, 985)],
  flowers: [P(1232, 330), P(372, 600), P(1240, 760)],
  mushrooms: [P(362, 450), P(1240, 520)],
  speaker: S(1420, 22, 1.15),
  themeToggle: S(1340, 22, 1.1),
  homeLink: P(1540, 30),
  startLabelLeft: true,
  critters: [
    C("coffee-stain", 110, 560, 1.4),
    C("hill-house", 150, 430, 1),
    C("butterfly", 330, 160, 1.3),
    C("dandelion", 50, 960, 1.2),
    C("ladybug", 1245, 425, 1.1),
    C("snail", 140, 968, 1.2),
    C("butterfly", 1180, 980, 0.9),
  ],
};

export const PORTRAIT: SheetLayout = {
  orientation: "portrait",
  width: 1000,
  height: 1600,
  ink: 1.3,
  quad: [P(52, 255), P(948, 255), P(985, 1110), P(15, 1110)],
  dice: S(195, 1385, 0.92),
  diceLabel: P(195, 1565),
  roster: { x: 390, y: 1232, width: 560, rowH: 64 },
  notes: P(500, 185),
  title: P(500, 660),
  caption: P(680, 1560),
  whale: null,
  sun: S(95, 95, 0.7),
  clouds: [S(820, 160, 0.7)],
  rainbow: null,
  bunting: { x: 210, y: -6, width: 520 },
  potatoes: [S(60, 212, 0.85), S(940, 212, 0.85)],
  grass: [P(160, 252), P(420, 250), P(640, 251), P(860, 252)],
  flowers: [P(350, 200), P(965, 1560)],
  mushrooms: [P(30, 1560)],
  speaker: S(800, 38, 1.3),
  themeToggle: S(690, 40, 1.25),
  homeLink: P(925, 48),
  startLabelLeft: false,
  critters: [C("butterfly", 330, 120, 1.3), C("snail", 80, 1540, 1.3), C("coffee-stain", 900, 1460, 1.3), C("ladybug", 960, 1195, 1)],
};

/**
 * Modern phones (about 9:19.5). The board is width-limited, so it grows downward instead: squares a
 * little taller than wide, doodles squeezed into a thin band on top, controls packed below.
 */
export const PORTRAIT_TALL: SheetLayout = {
  orientation: "portrait",
  width: 1000,
  height: 2000,
  ink: 1.3,
  quad: [P(40, 250), P(960, 250), P(990, 1335), P(10, 1335)],
  dice: S(205, 1615, 1.0),
  diceLabel: P(205, 1808),
  roster: { x: 400, y: 1470, width: 560, rowH: 70 },
  notes: P(500, 180),
  title: P(500, 780),
  caption: P(560, 1975),
  whale: S(730, 1880, 0.62),
  sun: S(82, 92, 0.6),
  clouds: [S(840, 165, 0.6)],
  rainbow: null,
  bunting: { x: 200, y: 4, width: 520 },
  potatoes: [S(52, 215, 0.7), S(948, 215, 0.7)],
  grass: [P(160, 248), P(420, 246), P(640, 247), P(860, 248), P(60, 1980)],
  flowers: [P(372, 228), P(965, 1975)],
  mushrooms: [P(30, 1960)],
  speaker: S(800, 38, 1.3),
  themeToggle: S(690, 40, 1.25),
  homeLink: P(925, 48),
  startLabelLeft: false,
  critters: [
    C("butterfly", 320, 118, 1.2),
    C("snail", 110, 1955, 1.2),
    C("coffee-stain", 110, 1860, 1.1),
    C("ladybug", 975, 1420, 1),
    C("dandelion", 968, 1790, 1),
  ],
};

/**
 * Squarer windows (laptops in a normal window, tablets in landscape): the board takes most of the
 * width and the controls stack in a narrow right column.
 */
export const LANDSCAPE_SQUARE: SheetLayout = {
  orientation: "landscape",
  width: 1320,
  height: 1000,
  ink: 1.1,
  quad: [P(118, 38), P(842, 38), P(902, 904), P(58, 904)],
  dice: S(1120, 570, 0.78),
  diceLabel: P(1120, 722),
  roster: { x: 960, y: 118, width: 330, rowH: 64 },
  notes: P(1120, 430),
  title: P(480, 455),
  caption: P(1120, 960),
  whale: S(1135, 830, 0.62),
  sun: null,
  clouds: [],
  rainbow: null,
  bunting: null,
  potatoes: [S(946, 905, 0.75)],
  grass: [P(200, 37), P(470, 36), P(760, 37)],
  flowers: [P(935, 420), P(940, 740)],
  mushrooms: [],
  speaker: S(1140, 32, 1.1),
  themeToggle: S(1060, 34, 1.05),
  homeLink: P(1255, 40),
  startLabelLeft: false,
  critters: [C("ladybug", 950, 560, 1)],
};

export function layoutFor(width: number, height: number): SheetLayout {
  const aspect = width / Math.max(1, height);
  if (aspect >= 1.45) return LANDSCAPE;
  if (aspect >= 1) return LANDSCAPE_SQUARE;
  return aspect < 0.56 ? PORTRAIT_TALL : PORTRAIT;
}
