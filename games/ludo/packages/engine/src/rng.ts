// mulberry32, the same generator as Snakes & Ladders' engine. Its state advances by a fixed constant
// per draw, so the n-th output is a pure function of (seed, n): the game stores only { seed, cursor }.
const STEP = 0x6d2b79f5;

export function rngAt(seed: number, cursor: number): number {
  let t = (seed + Math.imul(cursor + 1, STEP)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface RngState {
  seed: number;
  cursor: number;
}

export function rollDie(rng: RngState): { value: number; rng: RngState } {
  const value = Math.floor(rngAt(rng.seed, rng.cursor) * 6) + 1;
  return { value, rng: { seed: rng.seed, cursor: rng.cursor + 1 } };
}
