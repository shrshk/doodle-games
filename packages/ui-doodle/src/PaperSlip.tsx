import type { ReactNode } from "react";
import { palette } from "./palette";

/** A torn paper note taped to the sheet. Centered on (0,0); `width`/`height` in sheet units. */
export function PaperSlip({
  width,
  height,
  children,
  tape = true,
}: {
  width: number;
  height: number;
  children?: ReactNode;
  tape?: boolean;
}) {
  const w = width / 2;
  const h = height / 2;
  const d = `M${-w},${-h + 2} L${w - 1},${-h} L${w},${h - 10} L${w - 12},${h} L${-w + 1},${h - 1} Z`;
  return (
    <g>
      <path d={d} fill="#000" opacity={0.08} transform="translate(3 4)" />
      <path d={d} fill="#FBF8F0" stroke={palette.ink} strokeWidth={1.4} strokeLinejoin="round" filter="url(#doodle-pencil)" />
      <path d={`M${w},${h - 10} L${w - 10},${h - 9} L${w - 12},${h}`} fill="#EDE6D6" stroke={palette.ink} strokeWidth={1.1} />
      {tape && (
        <rect
          x={-18}
          y={-h - 8}
          width={36}
          height={14}
          fill="#E9DFC4"
          opacity={0.8}
          transform={`rotate(-4 0 ${-h})`}
        />
      )}
      {children}
    </g>
  );
}
