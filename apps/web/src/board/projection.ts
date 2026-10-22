export interface Pt {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];

/**
 * Projective map from the unit square onto a quad (Heckbert's square-to-quad). Unlike a plain
 * trapezoid stretch, rows foreshorten toward the narrow edge, so the sheet reads as lying on a desk.
 */
export function squareToQuad([p0, p1, p2, p3]: Quad): (u: number, v: number) => Pt {
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let a: number, b: number, d: number, e: number, g: number, h: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    g = 0;
    h = 0;
  } else {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const det = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / det;
    h = (dx1 * sy - sx * dy1) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
  }
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

/** Catmull-Rom spline through the points, as an SVG path. */
export function smoothPath(points: Pt[], closed = false): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) return `M${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")}`;
  const at = (i: number) => (closed ? points[(i + n) % n]! : points[Math.max(0, Math.min(n - 1, i))]!);
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(points[0]!.x)},${f(points[0]!.y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)},${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)},${f(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}
