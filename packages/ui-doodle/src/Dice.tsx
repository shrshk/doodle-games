import { useEffect, useState } from "react";
import { palette } from "./palette";

// Front face is the square (20,30)-(70,80) in a 100x100 box; top and right faces fake a cube.
const C = { x: 45, y: 55 };
const O = 13.5;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const FRONT = "M21,31 Q45,28.5 70,30.5 Q71.5,55 69.5,80 Q45,81.5 20.5,79.5 Q19,55 21,31 Z";
const TOP = "M21,31 L36,16.5 Q60,15 85.5,15.5 L70,30.5 Q45,28.5 21,31 Z";
const RIGHT = "M70,30.5 L85.5,15.5 Q86.5,40 85,64.5 L69.5,80 Q71.5,55 70,30.5 Z";

/**
 * A doodled die. While `rolling` it tumbles and flickers random faces (visual only; the real
 * value always comes from the engine), then lands on `value` with its pips drawn on.
 */
export function Dice({ value, rolling, tumble = true }: { value: number | null; rolling: boolean; tumble?: boolean }) {
  const [flicker, setFlicker] = useState(1);
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFlicker(1 + Math.floor(Math.random() * 6)), 85);
    return () => clearInterval(id);
  }, [rolling]);

  const face = rolling ? flicker : value;
  return (
    <g className={rolling && tumble ? "doodle-tumble" : undefined}>
      <g filter="url(#doodle-pencil)">
        <path d={TOP} fill="#F7F2E8" stroke={palette.ink} strokeWidth={2.2} strokeLinejoin="round" />
        <path d={TOP} fill="url(#doodle-streak-dark)" />
        <path d={RIGHT} fill="#E9E2D3" stroke={palette.ink} strokeWidth={2.2} strokeLinejoin="round" />
        <path d={RIGHT} fill="url(#doodle-streak-dark)" />
        <path d={FRONT} fill="#FBF8F1" stroke={palette.ink} strokeWidth={2.4} strokeLinejoin="round" />
        {/* tiny decorative pips on the side faces */}
        <ellipse cx={53} cy={23} rx={3} ry={1.6} fill={palette.ink} opacity={0.7} />
        <ellipse cx={78} cy={36} rx={1.5} ry={3} fill={palette.ink} opacity={0.7} />
        <ellipse cx={77} cy={58} rx={1.5} ry={3} fill={palette.ink} opacity={0.7} />
      </g>
      {face !== null && (
        <g key={rolling ? "rolling" : `landed-${face}`} filter="url(#doodle-crayon)">
          {PIPS[face]!.map(([dx, dy], i) => (
            <circle
              key={`${dx},${dy}`}
              cx={C.x + dx * O}
              cy={C.y + dy * O}
              r={face === 1 ? 6.5 : 4.6}
              fill={face === 1 ? palette.crayonRed : palette.ink}
              className={rolling ? undefined : "doodle-pip"}
              style={{ animationDelay: `${i * 55}ms` }}
            />
          ))}
        </g>
      )}
    </g>
  );
}
