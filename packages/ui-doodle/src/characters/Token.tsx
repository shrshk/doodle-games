import { Crayon } from "../PencilDefs";
import type { Mood } from "../Face";
import { tokenInk, type TokenColor } from "../palette";
import { Bee, Blob, EGG_PATH, Mushroom, Owl } from "./Characters";

export type TokenStage = "hidden" | "outline" | "egg" | "full";

const eggFill: Record<TokenColor, string> = {
  red: "#F2C18C",
  yellow: "#F2D67A",
  orange: "#F0C27C",
  indigo: "#8D8FD0",
};

/** A player character, drawn in the 100x100 character box. Sketches itself in by stage. */
export function Token({ color, mood = "idle", stage = "full" }: { color: TokenColor; mood?: Mood; stage?: TokenStage }) {
  if (stage === "hidden") return null;
  if (stage === "outline") {
    return (
      <path
        d={EGG_PATH}
        pathLength={1}
        className="doodle-draw"
        fill="none"
        stroke={tokenInk[color]}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    );
  }
  if (stage === "egg") {
    return (
      <g filter="url(#doodle-crayon-token)">
        <Crayon d={EGG_PATH} fill={eggFill[color]} stroke={tokenInk[color]} />
      </g>
    );
  }
  const Character = { red: Mushroom, yellow: Bee, orange: Owl, indigo: Blob }[color];
  return (
    <g filter="url(#doodle-crayon-token)" className="doodle-pop-in">
      <Character mood={mood} />
    </g>
  );
}
