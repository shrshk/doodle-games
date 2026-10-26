import { DEFAULT_RULES, type RuleSet } from "@snakes-doodle/engine";
import { palette } from "@doodle-games/ui-doodle";
import { sfx } from "../sound";

/** Every rule toggle the engine supports, in plain words. */
const RULES: { key: keyof RuleSet; label: string; on(r: RuleSet): boolean; toggle(r: RuleSet): Partial<RuleSet> }[] = [
  {
    key: "sixRule",
    label: "a 6 means roll again (three 6s lose the turn)",
    on: (r) => r.sixRule,
    toggle: (r) => ({ sixRule: !r.sixRule }),
  },
  {
    key: "startOnSix",
    label: "need a 6 to get on the board",
    on: (r) => r.startOnSix,
    toggle: (r) => ({ startOnSix: !r.startOnSix }),
  },
  {
    key: "overshoot",
    label: "too far? bounce back from the end",
    on: (r) => r.overshoot === "bounce",
    toggle: (r) => ({ overshoot: r.overshoot === "bounce" ? "stay" : "bounce" }),
  },
  {
    key: "chainJumps",
    label: "snakes and ladders can chain",
    on: (r) => r.chainJumps,
    toggle: (r) => ({ chainJumps: !r.chainJumps }),
  },
  {
    key: "playForPlaces",
    label: "keep playing for 2nd, 3rd and 4th",
    on: (r) => r.playForPlaces,
    toggle: (r) => ({ playForPlaces: !r.playForPlaces }),
  },
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
  const changed = RULES.filter((r) => r.on(rules) !== r.on(DEFAULT_RULES)).length;
  return (
    <details className="house-rules">
      <summary>
        house rules <span className="house-rules-note">{changed === 0 ? "(the usual)" : `(${changed} changed)`}</span>
      </summary>
      <ul>
        {RULES.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              role="switch"
              aria-checked={r.on(rules)}
              onClick={() => {
                sfx.tap();
                onChange(r.toggle(rules));
              }}
            >
              <DoodleCheck on={r.on(rules)} />
              <span>{r.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
