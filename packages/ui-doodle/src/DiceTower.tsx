import { Crayon } from "./PencilDefs";
import { Dice } from "./Dice";
import { palette } from "./palette";

// A doodled wooden dice tower. Local units: tower body x -75..75, y -110..130 (floor at 130); the
// hopper rises to y -160 and the tray runs right to x 205. The die drops into the hopper,
// clatters down three baffles behind a cutaway window, leaves through the arch and settles in the
// tray. The whole run lasts TOWER_MS; the page syncs its sounds to TOWER_HITS.

export const TOWER_MS = 1350;
/** fractions of TOWER_MS where the die hits something: baffles, the arch sill, the tray */
export const TOWER_HITS = [0.2, 0.29, 0.43, 0.5, 0.64, 0.73, 0.82, 0.9];
/** where the die rests in the tray, for anything that wants to point at it */
export const TOWER_TRAY = { x: 140, y: 112 };

const WOOD = "#D6A86C";
const WOOD_DARK = "#A8743F";
const WOOD_INK = "#6B4423";
const INSIDE = "#5C3E24";

/** outer outline of the tower body (slightly tapered), hopper and arch cut out by the front frame */
const BODY = "M-72,-108 L72,-110 L76,130 L-76,131 Z";
const WINDOW = "M-54,-92 L54,-93 L56,92 L-55,93 Z";
/** arch where the die leaves, bottom right of the front */
const ARCH = "M28,131 L28,104 Q50,88 72,104 L72,131 Z";
const HOPPER = "M-68,-160 L68,-162 L46,-108 L-46,-107 Z";
const HOPPER_MOUTH = "M-58,-156 L58,-157 L40,-110 L-40,-109 Z";
const BAFFLES = [
  "M-55,-64 L28,-36 L28,-30 L-55,-58 Z",
  "M55,-12 L-28,16 L-28,22 L55,-6 Z",
  "M-55,38 L28,66 L28,72 L-55,44 Z",
];
const TRAY_BACK = "M64,98 L205,96 L207,108 L66,110 Z";
const TRAY_FLOOR = "M66,110 L207,108 L209,128 L68,131 Z";
const TRAY_LIP = "M64,122 L209,120 L210,134 L64,137 Z";

/** plank seams on the side faces and a few nail heads */
function WoodDetail() {
  return (
    <g stroke={WOOD_INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} fill="none">
      <path d="M-74,-40 L-58,-40 M-75,20 L-58,20 M-76,80 L-58,80 M58,-50 L73,-50 M58,10 L74,10 M58,70 L75,70" />
      <g fill={WOOD_INK} stroke="none">
        {[
          [-66, -100],
          [64, -101],
          [-66, 122],
          [66, 122],
          [-66, 0],
          [66, 0],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={2} />
        ))}
      </g>
    </g>
  );
}

export function DiceTower({
  value,
  rolling,
  rollId,
  reduced = false,
}: {
  value: number | null;
  rolling: boolean;
  /** changes on every roll, so the drop animation restarts */
  rollId: number;
  reduced?: boolean;
}) {
  const dropping = rolling && !reduced;
  return (
    <g>
      {/* soft shadow on the desk */}
      <ellipse cx={60} cy={136} rx={150} ry={10} fill="#3B2F2A" opacity={0.1} />
      <g filter="url(#doodle-crayon)">
        {/* inside of the tower, seen through the window */}
        <path d={BODY} fill={INSIDE} />
        <path d={WINDOW} fill="#7A5534" />
        {BAFFLES.map((d) => (
          <Crayon key={d} d={d} fill={WOOD} stroke={WOOD_INK} strokeWidth={1.6} />
        ))}
        {/* tray: back wall and floor sit behind the die */}
        <Crayon d={TRAY_BACK} fill={WOOD_DARK} stroke={WOOD_INK} strokeWidth={1.8} />
        <Crayon d={TRAY_FLOOR} fill="#E6C291" stroke={WOOD_INK} strokeWidth={1.8} />
      </g>

      {/* the die: a fresh group per roll restarts the drop */}
      <g key={rollId} className={dropping ? "tower-drop" : undefined} style={dropping ? undefined : { transform: `translate(${TOWER_TRAY.x}px, ${TOWER_TRAY.y}px)` }}>
        <g transform="scale(0.62) translate(-52 -55)">
          {value !== null || rolling ? <Dice value={value} rolling={rolling} tumble={false} /> : null}
        </g>
      </g>

      <g filter="url(#doodle-crayon)">
        {/* front frame: the body with the window and the arch cut out, so the die shows only there */}
        <path d={`${BODY} ${WINDOW} ${ARCH}`} fill={WOOD} fillRule="evenodd" />
        <path d={`${BODY} ${WINDOW} ${ARCH}`} fill="url(#doodle-streak)" fillRule="evenodd" />
        <path d={BODY} fill="none" stroke={WOOD_INK} strokeWidth={2.4} strokeLinejoin="round" />
        <path d={WINDOW} fill="none" stroke={WOOD_INK} strokeWidth={2} strokeLinejoin="round" />
        <path d={ARCH} fill="none" stroke={WOOD_INK} strokeWidth={2} strokeLinejoin="round" />
        <WoodDetail />
        {/* hopper on top */}
        <Crayon d={HOPPER} fill={WOOD} stroke={WOOD_INK} strokeWidth={2.4} />
        <path d={HOPPER_MOUTH} fill={INSIDE} opacity={0.9} />
        {/* tray front lip in front of the die */}
        <Crayon d={TRAY_LIP} fill={WOOD} stroke={WOOD_INK} strokeWidth={2} />
        <path d="M80,127 L196,125" stroke={WOOD_INK} strokeWidth={1} opacity={0.5} />
      </g>
      {/* a little star engraved on the hopper */}
      <path
        d="M0,-146 L3,-139 L10,-139 L4,-134 L6,-127 L0,-131 L-6,-127 L-4,-134 L-10,-139 L-3,-139 Z"
        fill={palette.pencilYellow}
        stroke="#B38A1E"
        strokeWidth={1}
      />
    </g>
  );
}
