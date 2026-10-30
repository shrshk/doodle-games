import { memo } from "react";
import { palette, STAR_PATH, tokenInk, type TokenColor } from "@doodle-games/ui-doodle";
import { BASE_ORIGIN, basePoint, N, PATH_CELLS } from "./geometry";

export const SEAT_COLORS: TokenColor[] = ["red", "yellow", "orange", "indigo"];

/** Soft crayon tints for the bases and home columns, one per seat. */
export const TINT: Record<TokenColor, string> = {
  red: "#F2B8B1",
  yellow: "#F5DE95",
  orange: "#F4C49C",
  indigo: "#BFC0E8",
};

/** A hand-drawn square: corners nudged by a fixed per-cell wobble, so it never redraws differently. */
function wobblySquare(x: number, y: number, s: number, seed: number): string {
  // a pencil wobble of a few units, whatever the size: big shapes must not look tilted
  const j = (k: number) => (((seed * 9301 + k * 49297) % 233280) / 233280 - 0.5) * Math.min(s * 0.06, 4);
  return `M${x + j(1)},${y + j(2)} L${x + s + j(3)},${y + j(4)} L${x + s + j(5)},${y + s + j(6)} L${x + j(7)},${y + s + j(8)} Z`;
}

/**
 * The still Ludo board: four crayon bases with their waiting spots, the cross of path cells with
 * coloured start squares, stars and home columns, and the four triangles of home in the middle.
 * Drawn once per game; nothing here animates (tokens and highlights live on the sheet above).
 */
export const BoardView = memo(function BoardView({ x, y, size }: { x: number; y: number; size: number }) {
  const u = size / N;
  const px = (c: number) => x + c * u;
  const py = (r: number) => y + r * u;
  const mid = { x: px(7.5), y: py(7.5) };
  // each seat's triangle: the edge of the middle square its home column runs into, then the centre
  const triangles: [[number, number], [number, number]][] = [
    [[6, 6], [6, 9]],
    [[6, 6], [9, 6]],
    [[9, 6], [9, 9]],
    [[6, 9], [9, 9]],
  ];

  return (
    <g className="ludo-board fade-in">
      {/* the board card, with a soft shadow on the desk */}
      <path d={wobblySquare(x + 8, y + 10, size, 3)} fill="#3B2F2A" opacity={0.12} />
      <path d={wobblySquare(x, y, size, 1)} fill="#FBF8F0" stroke={palette.ink} strokeWidth={3} strokeLinejoin="round" />

      <g filter="url(#doodle-crayon)">
        {BASE_ORIGIN.map((o, seat) => {
          const color = SEAT_COLORS[seat]!;
          return (
            <g key={seat}>
              <path d={wobblySquare(px(o.x), py(o.y), u * 6, 10 + seat)} fill={tokenInk[color]} opacity={0.88} />
              <path d={wobblySquare(px(o.x + 0.9), py(o.y + 0.9), u * 4.2, 20 + seat)} fill="#FBF8F0" />
              <path d={wobblySquare(px(o.x + 0.9), py(o.y + 0.9), u * 4.2, 20 + seat)} fill={TINT[color]} opacity={0.35} />
            </g>
          );
        })}

        {PATH_CELLS.map((cell, i) => {
          const color = cell.seat !== undefined ? SEAT_COLORS[cell.seat]! : null;
          const fill = cell.kind === "start" ? tokenInk[color!] : cell.kind === "column" ? TINT[color!] : "#FFFDF6";
          return <path key={i} d={wobblySquare(px(cell.col), py(cell.row), u, i + 40)} fill={fill} />;
        })}

        {triangles.map(([a, b], seat) => (
          <path
            key={seat}
            d={`M${px(a[0])},${py(a[1])} L${px(b[0])},${py(b[1])} L${mid.x},${mid.y} Z`}
            fill={tokenInk[SEAT_COLORS[seat]!]}
            opacity={0.9}
          />
        ))}
      </g>

      {/* ink on top of the crayon: cell outlines, base spots, stars, the start arrows */}
      <g filter="url(#doodle-pencil)" fill="none" stroke={palette.ink} strokeLinejoin="round">
        {PATH_CELLS.map((cell, i) => (
          <path key={i} d={wobblySquare(px(cell.col), py(cell.row), u, i + 40)} strokeWidth={1.6} opacity={0.75} />
        ))}
        {BASE_ORIGIN.map((o, seat) => (
          <g key={seat}>
            <path d={wobblySquare(px(o.x), py(o.y), u * 6, 10 + seat)} strokeWidth={2.2} />
            <path d={wobblySquare(px(o.x + 0.9), py(o.y + 0.9), u * 4.2, 20 + seat)} strokeWidth={1.8} />
            {[0, 1, 2, 3].map((t) => {
              const p = basePoint(seat, t);
              return (
                <circle
                  key={t}
                  cx={px(p.x)}
                  cy={py(p.y)}
                  r={u * 0.62}
                  fill={TINT[SEAT_COLORS[seat]!]}
                  stroke={tokenInk[SEAT_COLORS[seat]!]}
                  strokeWidth={2.4}
                />
              );
            })}
          </g>
        ))}
        {triangles.map(([a, b], seat) => (
          <path key={seat} d={`M${px(a[0])},${py(a[1])} L${px(b[0])},${py(b[1])} L${mid.x},${mid.y} Z`} strokeWidth={2} />
        ))}
      </g>

      {PATH_CELLS.filter((c) => c.kind === "star" || c.kind === "start").map((cell, i) => (
        <g key={i} transform={`translate(${px(cell.col + 0.5)} ${py(cell.row + 0.5)}) scale(${(u / 30).toFixed(3)})`} opacity={cell.kind === "start" ? 0.55 : 1}>
          <path d={STAR_PATH} fill={cell.kind === "start" ? "#FFFDF6" : palette.pencilYellow} stroke={cell.kind === "start" ? "#FFFDF6" : "#C9962A"} strokeWidth={1} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
});
