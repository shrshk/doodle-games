// mulberry32. Its internal state advances by a fixed constant per draw, so the n-th output is a
// pure function of (seed, n). The engine stores only { seed, cursor } and never mutates a generator.
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

/** Stateful generator for callers that just need a stream (renderer jitter, simulations). */
export function createRng(seed: number): () => number {
  let cursor = 0;
  return () => rngAt(seed, cursor++);
}

/** FNV-1a, for turning a board id into a stable seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
