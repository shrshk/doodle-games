import { DEFAULT_RULES, type RuleSet } from "@ludo-doodle/engine";
import { palette } from "@doodle-games/ui-doodle";
import { sfx } from "../sound";

/** Every rule toggle the engine supports, in plain words. The defaults are Ludo King's classic game. */
const RULES: { key: keyof RuleSet; label: string }[] = [
  { key: "needSixToStart", label: "need a 6 to bring a token out" },
  { key: "sixAgain", label: "a 6 means roll again" },
  { key: "threeSixesForfeit", label: "three 6s in a row lose the turn" },
  { key: "cutBonus", label: "cutting a token earns another roll" },
  { key: "homeBonus", label: "a token reaching home earns another roll" },
  { key: "safeSquares", label: "stars and start squares are safe" },
  { key: "blocks", label: "two tokens of one colour make a wall" },
  { key: "playForPlaces", label: "keep playing for 2nd, 3rd and 4th" },
];

/** Hand-drawn checkbox: a wobbly square, with a crayon tick when on. */
function DoodleCheck({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="doodle-check" aria-hidden="true">
      <path d="M5,6 Q16,4 27,5.5 Q28.5,16 26.5,27 Q16,28.5 5.5,26.5 Q3.5,16 5,6 Z" fill="#FBF8F0" stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" />
      {on && (
        <path
          d="M8,16 L14,23 L27,6"
          fill="none"
          stroke={palette.crayonRed}
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="doodle-draw"
          style={{ ["--draw-duration" as string]: "260ms" }}
        />
      )}
    </svg>
  );
}

export function HouseRules({ rules, onChange }: { rules: RuleSet; onChange(patch: Partial<RuleSet>): void }) {
  const changed = RULES.filter((r) => rules[r.key] !== DEFAULT_RULES[r.key]).length;
  return (
    <details className="house-rules">
      <summary>
        house rules <span className="house-rules-note">{changed === 0 ? "(ludo king classic)" : `(${changed} changed)`}</span>
      </summary>
      <ul>
        {RULES.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              role="switch"
              aria-checked={rules[r.key]}
              onClick={() => {
                sfx.tap();
                onChange({ [r.key]: !rules[r.key] });
              }}
            >
              <DoodleCheck on={rules[r.key]} />
              <span>{r.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
