// Where everything sits on the sheet. The sheet is one SVG viewBox, scaled to fit the screen:
// landscape puts the board on the left and the dice and players on the right; portrait (phones)
// puts the board on top and the controls underneath.

export interface SheetLayout {
  orientation: "landscape" | "portrait";
  width: number;
  height: number;
  /** the square board: top-left corner and side */
  board: { x: number; y: number; size: number };
  dice: { x: number; y: number; s: number };
  diceLabel: { x: number; y: number };
  roster: { x: number; y: number; width: number; rowH: number };
  notes: { x: number; y: number };
  title: { x: number; y: number };
  homeLink: { x: number; y: number };
  speaker: { x: number; y: number; s: number };
}

const LANDSCAPE: SheetLayout = {
  orientation: "landscape",
  width: 1600,
  height: 1000,
  board: { x: 40, y: 40, size: 920 },
  dice: { x: 1290, y: 600, s: 0.95 },
  diceLabel: { x: 1290, y: 820 },
  roster: { x: 1030, y: 140, width: 520, rowH: 66 },
  notes: { x: 1290, y: 910 },
  title: { x: 500, y: 470 },
  homeLink: { x: 1080, y: 70 },
  speaker: { x: 1530, y: 62, s: 1.1 },
};

const PORTRAIT: SheetLayout = {
  orientation: "portrait",
  width: 1000,
  // phones are about 1:2; a taller sheet fills them instead of leaving bands above and below
  height: 1900,
  board: { x: 30, y: 110, size: 940 },
  dice: { x: 250, y: 1430, s: 1.1 },
  diceLabel: { x: 250, y: 1720 },
  roster: { x: 470, y: 1110, width: 500, rowH: 86 },
  notes: { x: 720, y: 1620 },
  title: { x: 500, y: 560 },
  homeLink: { x: 90, y: 66 },
  speaker: { x: 930, y: 58, s: 1.2 },
};

export function layoutFor(width: number, height: number): SheetLayout {
  return height > width * 1.05 ? PORTRAIT : LANDSCAPE;
}
