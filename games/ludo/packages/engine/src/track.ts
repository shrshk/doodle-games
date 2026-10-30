// The Ludo track, independent of how it is drawn.
//
// A token's position is its progress from its own start square:
//   BASE (-1)        in its base, waiting for a 6
//   0 .. 50          on the shared 52-square track (0 = its start square)
//   51 .. 55         up its own home column
//   HOME (56)        home; it is finished
// On the shared track, seat s's progress p sits on square (s * 13 + p) mod 52.

export const BASE = -1;
export const TRACK_SQUARES = 52;
/** last progress on the shared track */
export const LAST_TRACK = 50;
export const HOME = 56;
/** squares between two seats' start squares */
export const SEAT_GAP = 13;
/** a star square lies this many squares after each start square */
export const STAR_OFFSET = 8;

/** The shared-track square for a progress, or null in the base, the home column or home. */
export function trackSquare(seat: number, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (seat * SEAT_GAP + progress) % TRACK_SQUARES;
}

export const startSquare = (seat: number) => seat * SEAT_GAP;

/** The 8 safe squares: each seat's start square and the star 8 squares after it. */
export const SAFE_SQUARES: ReadonlySet<number> = new Set(
  [0, 1, 2, 3].flatMap((s) => [startSquare(s), startSquare(s) + STAR_OFFSET]),
);
