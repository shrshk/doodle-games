import { Crayon } from "../PencilDefs";
import { palette } from "../palette";

// Small doodles for board squares and margins. Each fits roughly a 40x40 box around its origin.

export function Heart() {
  return (
    <g filter="url(#doodle-crayon)">
      <Crayon d="M0,10 C-14,0 -14,-12 -6,-12 C-2,-12 0,-8 0,-6 C0,-8 2,-12 6,-12 C14,-12 14,0 0,10 Z" fill="#EE8E9A" stroke={palette.crayonRed} strokeWidth={1.4} />
    </g>
  );
}

export function Sparkle({ color = palette.pencilYellow }: { color?: string }) {
  return (
    <g stroke={color} strokeWidth={2} strokeLinecap="round" fill="none">
      <path d="M0,-11 L0,11 M-11,0 L11,0" />
      <path d="M-6,-6 L6,6 M6,-6 L-6,6" strokeWidth={1.2} />
    </g>
  );
}

export function Ladybug() {
  return (
    <g filter="url(#doodle-crayon)">
      <path d="M-11,6 l-5,3 M-11,0 l-6,0 M-11,-6 l-5,-3 M11,6 l5,3 M11,0 l6,0 M11,-6 l5,-3" stroke={palette.ink} strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={0} cy={-12} r={5.5} fill={palette.ink} />
      <Crayon d="M0,-9 C10,-9 13,-2 13,3 C13,11 7,14 0,14 C-7,14 -13,11 -13,3 C-13,-2 -10,-9 0,-9 Z" fill={palette.crayonRed} stroke="#8E2F29" strokeWidth={1.3} />
      <path d="M0,-9 L0,14" stroke={palette.ink} strokeWidth={1.1} />
      {[
        [-6, -2],
        [6, -1],
        [-5, 7],
        [6, 8],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2.2} fill={palette.ink} />
      ))}
    </g>
  );
}

export function Snail() {
  return (
    <g filter="url(#doodle-crayon)">
      <Crayon d="M-16,10 C-10,6 10,6 20,10 C22,12 20,13 16,13 L-16,13 C-19,13 -19,11 -16,10 Z" fill="#E9D6A8" stroke="#A8823F" strokeWidth={1.2} />
      <path d="M17,9 L21,-3 M19,9 L25,-1" stroke="#A8823F" strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={21} cy={-4} r={1.4} fill={palette.ink} />
      <circle cx={25} cy={-2} r={1.4} fill={palette.ink} />
      <Crayon d="M-12,9 C-16,-2 -8,-12 2,-11 C12,-10 14,2 8,8 Z" fill="#E0A77A" stroke="#9A5A35" strokeWidth={1.3} />
      <path d="M-1,6 C-8,3 -6,-6 1,-6 C6,-6 7,0 2,1 C-1,1 -1,-2 1,-2" fill="none" stroke="#9A5A35" strokeWidth={1.1} />
    </g>
  );
}

export function Butterfly() {
  return (
    <g filter="url(#doodle-crayon)" className="doodle-flutter">
      <Crayon d="M0,0 C-6,-14 -20,-16 -18,-4 C-17,2 -8,2 0,0 Z" fill="#B9A1DE" stroke="#6F55A6" strokeWidth={1.2} />
      <Crayon d="M0,0 C6,-14 20,-16 18,-4 C17,2 8,2 0,0 Z" fill="#B9A1DE" stroke="#6F55A6" strokeWidth={1.2} />
      <Crayon d="M0,1 C-4,6 -14,12 -12,4 C-11,1 -5,1 0,1 Z" fill="#F2C1D1" stroke="#6F55A6" strokeWidth={1.1} />
      <Crayon d="M0,1 C4,6 14,12 12,4 C11,1 5,1 0,1 Z" fill="#F2C1D1" stroke="#6F55A6" strokeWidth={1.1} />
      <path d="M0,-6 L0,7 M0,-6 Q-3,-12 -5,-13 M0,-6 Q3,-12 5,-13" stroke={palette.ink} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </g>
  );
}

export function CoffeeStain() {
  return (
    <g fill="none" stroke="#B48B5E" strokeLinecap="round">
      <path d="M0,-30 C18,-30 30,-17 30,1 C30,18 16,30 -2,30 C-19,30 -30,16 -30,-1 C-30,-19 -17,-29 2,-30" strokeWidth={3.2} opacity={0.32} />
      <path d="M-24,-10 C-22,-22 -10,-27 2,-27" strokeWidth={1.4} opacity={0.25} />
      <circle cx={34} cy={18} r={2.5} fill="#B48B5E" opacity={0.25} stroke="none" />
    </g>
  );
}

export function Dandelion() {
  return (
    <g fill="none" strokeLinecap="round">
      <path d="M0,0 Q4,-24 0,-48" stroke="#6FA05A" strokeWidth={1.6} />
      <path d="M1,-14 q10,-8 14,-2 q-8,4 -14,2" stroke="#6FA05A" strokeWidth={1.1} fill="#A8CC8C" />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const x = Math.cos(a) * 11;
        const y = -50 + Math.sin(a) * 11;
        return (
          <g key={i} stroke="#9A8F80" strokeWidth={0.9}>
            <path d={`M0,-50 L${x.toFixed(1)},${y.toFixed(1)}`} />
            <circle cx={x} cy={y} r={1.6} />
          </g>
        );
      })}
    </g>
  );
}

export function HillHouse() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-90,20 C-50,-6 -10,-10 30,-4 C60,0 80,10 92,20" stroke={palette.crayonBlue} strokeWidth={1.8} />
      <path d="M-70,22 l6,-6 M-50,20 l5,-7 M30,18 l5,-6 M60,22 l5,-6" stroke={palette.crayonBlue} strokeWidth={1.1} opacity={0.7} />
      <path d="M-6,-8 L-6,-26 L4,-36 L14,-26 L14,-8" stroke={palette.ink} strokeWidth={1.6} />
      <path d="M-9,-24 L4,-38 L17,-24" stroke={palette.crayonRed} strokeWidth={1.8} />
      <path d="M1,-8 L1,-16 L7,-16 L7,-8" stroke={palette.ink} strokeWidth={1.2} />
      <path d="M10,-31 L10,-38 L13,-38 L13,-28" stroke={palette.ink} strokeWidth={1.2} />
      <path d="M11,-42 c-3,-3 3,-5 0,-8 c-3,-3 3,-5 0,-8" stroke="#9A8F80" strokeWidth={1.1} className="doodle-zzz" />
      <path d="M50,-6 L50,-22 M44,-14 L56,-14 M45,-20 L55,-20" stroke="#6FA05A" strokeWidth={1.4} />
    </g>
  );
}

export function Flag() {
  return (
    <g filter="url(#doodle-crayon)">
      <path d="M0,14 L0,-18" stroke={palette.pencilBrown} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0,-18 C8,-20 12,-14 20,-16 L18,-6 C11,-4 7,-10 0,-8 Z" fill={palette.crayonRed} stroke="#8E2F29" strokeWidth={1.2} className="doodle-wave" />
    </g>
  );
}

/** Hand-drawn speaker; waves when on, a cross when muted. About 40x30 around the origin. */
export function Speaker({ muted }: { muted: boolean }) {
  return (
    <g fill="none" stroke={palette.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-16,-5 L-9,-5 L0,-13 L0,13 L-9,5 L-16,5 Z" fill="#FBF8F0" />
      {muted ? (
        <path d="M6,-6 L16,6 M16,-6 L6,6" stroke={palette.crayonRed} />
      ) : (
        <g stroke={palette.crayonBlue}>
          <path d="M5,-5 Q9,0 5,5" />
          <path d="M9,-10 Q16,0 9,10" />
        </g>
      )}
    </g>
  );
}

/** Day / night switch: a little sun by day, a crescent moon with a star by night. ~40x30 around 0,0. */
export function ThemeIcon({ night }: { night: boolean }) {
  if (night) {
    return (
      <g strokeLinejoin="round">
        <path d="M2,-13 A13,13 0 1 0 12,8 A10,10 0 1 1 2,-13 Z" fill={palette.pencilYellow} stroke="#B38A1E" strokeWidth={1.6} />
        <path d="M14,-12 l1.5,3 3,0.4 -2.2,2 0.6,3 -2.9,-1.5 -2.9,1.5 0.6,-3 -2.2,-2 3,-0.4 Z" fill={palette.pencilYellow} stroke="#B38A1E" strokeWidth={0.8} />
      </g>
    );
  }
  return (
    <g>
      <path
        d="M0,-15 L0,-11 M0,11 L0,15 M-15,0 L-11,0 M11,0 L15,0 M-10.6,-10.6 L-7.8,-7.8 M7.8,7.8 L10.6,10.6 M-10.6,10.6 L-7.8,7.8 M7.8,-7.8 L10.6,-10.6"
        stroke="#E0A93A"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle r={7.5} fill={palette.pencilYellow} stroke="#C9962A" strokeWidth={1.6} />
    </g>
  );
}
