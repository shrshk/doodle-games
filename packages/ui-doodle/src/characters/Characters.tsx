import { useId } from "react";
import { Crayon } from "../PencilDefs";
import { Face, type Mood } from "../Face";
import { palette } from "../palette";

// Every character lives in a 100x100 box with its feet near (50, 96).

export interface CharacterProps {
  mood?: Mood;
}

function Shadow() {
  return (
    <path
      d="M36,98 l8,-2 M45,99 l9,-2.4 M55,98.5 l8,-2"
      stroke="#9A8F80"
      strokeWidth={1.1}
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}

export function Mushroom({ mood = "idle" }: CharacterProps) {
  return (
    <g>
      <Shadow />
      <ellipse cx={42} cy={94} rx={5} ry={3} fill="#E9A867" stroke="#C27A40" strokeWidth={1.4} />
      <ellipse cx={58} cy={94} rx={5} ry={3} fill="#E9A867" stroke="#C27A40" strokeWidth={1.4} />
      <Crayon
        d="M33,46 C29,60 29,82 37,89 C43,94 57,94 63,89 C71,82 71,60 67,46 Z"
        fill="#F4C48E"
        stroke="#C27A40"
      />
      <Crayon
        d="M16,48 C14,26 32,10 50,10 C68,10 86,26 84,48 C70,54 30,54 16,48 Z"
        fill={palette.crayonRed}
        stroke="#A23C34"
      />
      {[
        [33, 28, 5.5],
        [52, 19, 4.5],
        [68, 31, 5],
        [45, 39, 3.5],
        [60, 43, 3],
        [24, 42, 3],
      ].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r! * 0.85} fill="#FFF7EE" opacity={0.92} />
      ))}
      <Face cx={50} cy={66} spread={9} mood={mood} />
    </g>
  );
}

export function Bee({ mood = "idle" }: CharacterProps) {
  const clip = useId();
  const body = "M50,24 C67,24 76,46 76,66 C76,84 64,94 50,94 C36,94 24,84 24,66 C24,46 33,24 50,24 Z";
  return (
    <g>
      <Shadow />
      <g opacity={0.95}>
        <ellipse cx={26} cy={44} rx={12} ry={17} transform="rotate(-28 26 44)" fill="#EEF4FA" stroke="#8AA3BE" strokeWidth={1.5} />
        <ellipse cx={74} cy={44} rx={12} ry={17} transform="rotate(28 74 44)" fill="#EEF4FA" stroke="#8AA3BE" strokeWidth={1.5} />
      </g>
      <path d="M43,26 Q38,16 34,10" fill="none" stroke="#6B4A2B" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M57,26 Q62,16 66,10" fill="none" stroke="#6B4A2B" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={34} cy={9.5} r={2.6} fill="#6B4A2B" />
      <circle cx={66} cy={9.5} r={2.6} fill="#6B4A2B" />
      <Crayon d={body} fill={palette.pencilYellow} stroke="#A67C1F" />
      <clipPath id={clip}>
        <path d={body} />
      </clipPath>
      <g clipPath={`url(#${clip})`} stroke="#6B4A2B" strokeWidth={6} strokeLinecap="round" opacity={0.85}>
        <path d="M18,72 Q50,78 82,71" fill="none" />
        <path d="M18,85 Q50,91 82,84" fill="none" />
      </g>
      <path d={body} fill="none" stroke="#A67C1F" strokeWidth={2} />
      <path d="M44,22 l2,-6 l4,4 l4,-4 l2,6 Z" fill="#E3A84B" stroke="#B5802A" strokeWidth={1.2} strokeLinejoin="round" />
      <Face cx={50} cy={50} spread={9} mood={mood} />
    </g>
  );
}

export function Owl({ mood = "idle" }: CharacterProps) {
  return (
    <g>
      <Shadow />
      <path d="M27,26 L22,8 L39,19 Z" fill="#D9963F" stroke="#A8682A" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M73,26 L78,8 L61,19 Z" fill="#D9963F" stroke="#A8682A" strokeWidth={1.6} strokeLinejoin="round" />
      <Crayon
        d="M50,16 C71,16 83,34 83,58 C83,80 69,95 50,95 C31,95 17,80 17,58 C17,34 29,16 50,16 Z"
        fill={palette.markerOrange}
        stroke="#A8682A"
      />
      <Crayon d="M50,54 C62,54 68,64 68,74 C68,86 60,92 50,92 C40,92 32,86 32,74 C32,64 38,54 50,54 Z" fill="#F6D9A4" stroke="#C99050" strokeWidth={1.2} />
      {[
        [44, 68],
        [56, 68],
        [50, 76],
        [42, 82],
        [58, 82],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x! - 3},${y} l3,3 l3,-3`} fill="none" stroke="#B9783A" strokeWidth={1.2} strokeLinecap="round" />
      ))}
      <path d="M18,52 Q12,68 22,82" fill="none" stroke="#A8682A" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M82,52 Q88,68 78,82" fill="none" stroke="#A8682A" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={39} cy={40} r={9.5} fill="#FBF3E2" stroke="#B9783A" strokeWidth={1.4} />
      <circle cx={61} cy={40} r={9.5} fill="#FBF3E2" stroke="#B9783A" strokeWidth={1.4} />
      <Face cx={50} cy={40} spread={11} eye={3.6} mood={mood} />
      <path d="M46,48 L54,48 L50,55 Z" fill="#E07B39" stroke="#A8552A" strokeWidth={1.1} strokeLinejoin="round" />
    </g>
  );
}

export function Blob({ mood = "idle" }: CharacterProps) {
  return (
    <g>
      <Shadow />
      <path d="M50,24 Q49,16 50,11" fill="none" stroke="#2A2A70" strokeWidth={1.6} strokeLinecap="round" />
      <path
        d="M50,2 L52.4,7.3 L58,7.8 L53.8,11.4 L55,17 L50,14 L45,17 L46.2,11.4 L42,7.8 L47.6,7.3 Z"
        fill={palette.pencilYellow}
        stroke="#B38A1E"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d="M38,26 q-6,-6 -4,-11 q5,2 7,9" fill="#7FB069" stroke="#4E7F3E" strokeWidth={1.2} />
      <Crayon
        d="M50,22 C68,22 76,40 78,62 C80,80 87,88 85,93 C70,97 30,97 15,93 C13,88 20,80 22,62 C24,40 32,22 50,22 Z"
        fill={palette.crayonBlue}
        stroke="#262668"
      />
      <Face cx={50} cy={56} spread={10} eye={3.6} mood={mood} sclera />
    </g>
  );
}

export const EGG_PATH = "M50,30 C64,30 72,52 72,68 C72,84 62,94 50,94 C38,94 28,84 28,68 C28,52 36,30 50,30 Z";
