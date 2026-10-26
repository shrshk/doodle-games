import type { Board } from "@snakes-doodle/boards";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Semantic checks the Zod schema can't express. Reachability assumes a d6 and the strictest
 * overshoot rule ("stay"), so a board that passes is playable under every rule toggle.
 */
export function validateBoard(board: Board, opts: { chainJumps?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  const { rows, cols, layout, customOrder } = board.grid;
  const final = rows * cols;
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= final;

  if (layout === "custom") {
    if (!customOrder || customOrder.length !== final) {
      errors.push(`custom layout needs ${final} cells in customOrder`);
    } else {
      const cells = new Set(customOrder.map(([r, c]) => `${r},${c}`));
      const outside = customOrder.some(([r, c]) => r < 0 || r >= rows || c < 0 || c >= cols);
      if (cells.size !== final || outside) errors.push("customOrder must list every grid cell exactly once");
    }
  }

  const jumps = new Map<number, number>();
  const items = [
    ...board.snakes.map((s) => ({ kind: "snake" as const, ...s })),
    ...board.ladders.map((l) => ({ kind: "ladder" as const, ...l })),
  ];
  for (const it of items) {
    const label = `${it.kind} ${it.from}->${it.to}`;
    if (!inRange(it.from) || !inRange(it.to)) {
      errors.push(`${label} is outside 1..${final}`);
      continue;
    }
    if (it.kind === "snake" && it.from <= it.to) errors.push(`${label} must go down`);
    if (it.kind === "ladder" && it.from >= it.to) errors.push(`${label} must go up`);
    if (it.from === final) errors.push(`${label} starts on the final square`);
    if (it.to === final) errors.push(`${label} jumps into the final square`);
    if (it.to === 1) errors.push(`${label} jumps into the start square`);
    if (jumps.has(it.from)) errors.push(`square ${it.from} starts more than one snake or ladder`);
    else jumps.set(it.from, it.to);
  }
  if (errors.length > 0) return { ok: false, errors };

  if (opts.chainJumps) {
    for (const start of jumps.keys()) {
      const seen = new Set<number>([start]);
      for (let at = jumps.get(start); at !== undefined; at = jumps.get(at)) {
        if (seen.has(at)) {
          errors.push(`chained jumps from ${start} loop forever`);
          break;
        }
        seen.add(at);
      }
    }
    if (errors.length > 0) return { ok: false, errors };
  }

  const land = (s: number) => {
    let at = s;
    const seen = new Set<number>([at]);
    for (let d = jumps.get(at); d !== undefined && !seen.has(d); d = jumps.get(at)) {
      at = d;
      seen.add(at);
      if (!opts.chainJumps) break;
    }
    return at;
  };
  const edges = new Map<number, number[]>();
  for (let s = 0; s < final; s++) {
    const out: number[] = [];
    for (let v = 1; v <= 6; v++) if (s + v <= final) out.push(land(s + v));
    edges.set(s, out);
  }

  const reachable = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const t of edges.get(s) ?? []) {
      if (!reachable.has(t)) {
        reachable.add(t);
        queue.push(t);
      }
    }
  }
  for (let s = 1; s <= final; s++) {
    if (!jumps.has(s) && !reachable.has(s)) errors.push(`square ${s} can never be reached`);
  }

  // Every reachable square must still be able to finish, or a game could never end.
  const canFinish = new Set<number>([final]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of reachable) {
      if (!canFinish.has(s) && (edges.get(s) ?? []).some((t) => canFinish.has(t))) {
        canFinish.add(s);
        grew = true;
      }
    }
  }
  for (const s of reachable) if (!canFinish.has(s)) errors.push(`a token on square ${s} can never finish`);

  return { ok: errors.length === 0, errors };
}
