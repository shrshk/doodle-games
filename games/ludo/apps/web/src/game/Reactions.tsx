import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { REACTION_TEXT, REACTIONS, type Reaction } from "@ludo-doodle/protocol";
import { palette } from "@doodle-games/ui-doodle";
import { sfx } from "../sound";
import { useGame } from "../store";

const TONE: Record<Reaction, string> = {
  nice: palette.crayonBlue,
  yay: palette.crayonRed,
  oops: palette.ink,
  lucky: "#2F8A4E",
  noo: palette.crayonRed,
  gg: palette.crayonBlue,
};
const TILT: Record<Reaction, number> = { nice: -3, yay: 2, oops: -1, lucky: 3, noo: -2, gg: 1 };

const BUBBLE_PATH = "M6,8 C14,3 34,3 42,8 C46,14 46,24 41,29 C34,33 24,33 18,32 L9,40 L11,30 C5,27 3,15 6,8 Z";

/** The doodled speech bubble on the reactions button, in a 48x44 box. */
function BubbleShape() {
  return (
    <>
      <path d={BUBBLE_PATH} fill="#FBF8F0" stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={16} cy={18} r={2.2} fill={palette.crayonRed} />
      <circle cx={24} cy={18} r={2.2} fill={palette.crayonBlue} />
      <circle cx={32} cy={18} r={2.2} fill={palette.pencilYellow} />
    </>
  );
}

/** Whether this tab holds a seat (spectators watch quietly; the server ignores them anyway). */
const useSeated = () => useGame((s) => !!s.online?.view?.players[s.online.me]);

/**
 * The six reactions as paper slips, opened next to whatever was tapped (`anchor`, in viewport
 * pixels): above it in the lower half of the screen, below it in the upper half.
 */
export function ReactionPicker({ anchor, onClose }: { anchor: DOMRect; onClose(): void }) {
  const react = useGame((s) => s.react);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // a tap anywhere else closes it (the opening tap has already happened)
    const onDown = (e: PointerEvent) => !panel.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    panel.current?.querySelector("button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const below = anchor.top + anchor.height / 2 < window.innerHeight / 2;
  const alignRight = anchor.left + anchor.width / 2 > window.innerWidth / 2;
  const style: CSSProperties = {
    ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }),
    ...(alignRight ? { right: Math.max(8, window.innerWidth - anchor.right) } : { left: Math.max(8, anchor.left) }),
    transformOrigin: `${below ? "top" : "bottom"} ${alignRight ? "right" : "left"}`,
  };
  return (
    <div ref={panel} className="reaction-picker" role="menu" aria-label="Quick reactions" style={style}>
      {REACTIONS.map((r) => (
        <button
          key={r}
          type="button"
          role="menuitem"
          className="reaction-slip"
          style={{ color: TONE[r], rotate: `${TILT[r]}deg` }}
          onClick={() => {
            react(r);
            onClose();
          }}
        >
          {REACTION_TEXT[r]}
        </button>
      ))}
    </div>
  );
}

/** The lobby's reactions button: a speech bubble in the bottom-left corner. */
export function ReactionButton() {
  const seated = useSeated();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  if (!seated) return null;
  return (
    <>
      <button
        type="button"
        className="reaction-toggle"
        aria-label="Quick reactions"
        aria-expanded={!!anchor}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          sfx.tap();
          setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect());
        }}
      >
        <svg viewBox="0 0 48 44" aria-hidden="true">
          <BubbleShape />
        </svg>
      </button>
      {anchor && <ReactionPicker anchor={anchor} onClose={close} />}
    </>
  );
}

/** The board's reactions button, drawn in the sheet at the layout's free spot. */
export function SheetReactionButton({ x, y, s, open, onOpen }: { x: number; y: number; s: number; open: boolean; onOpen(rect: DOMRect | null): void }) {
  const seated = useSeated();
  if (!seated) return null;
  const toggle = (el: Element) => {
    sfx.tap();
    onOpen(open ? null : el.getBoundingClientRect());
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label="Quick reactions"
      aria-expanded={open}
      className="home-link"
      transform={`translate(${x} ${y}) scale(${s}) translate(-24 -22)`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => toggle(e.currentTarget)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(e.currentTarget))}
    >
      <rect x={-4} y={-4} width={56} height={52} fill="transparent" />
      <BubbleShape />
    </g>
  );
}

/** A reaction popping up in sheet coordinates (above a token). */
export function SheetBubble({ x, y, reaction, sheetWidth, reduced }: { x: number; y: number; reaction: Reaction; sheetWidth: number; reduced: boolean }) {
  const text = REACTION_TEXT[reaction];
  const w = Math.max(96, text.length * 19 + 44);
  const h = 62;
  // keep the whole bubble on the sheet; the tail still points at the token
  const cx = Math.min(sheetWidth - w / 2 - 8, Math.max(w / 2 + 8, x));
  const top = Math.max(8, y - h - 26);
  const tailX = Math.min(cx + w / 2 - 18, Math.max(cx - w / 2 + 18, x));
  const body = `M${cx - w / 2},${top + 6} C${cx - w / 4},${top - 2} ${cx + w / 4},${top - 1} ${cx + w / 2},${top + 5}
    C${cx + w / 2 + 4},${top + h / 2} ${cx + w / 2 + 2},${top + h - 8} ${cx + w / 2 - 3},${top + h - 2}
    L${tailX + 10},${top + h} L${tailX},${top + h + 18} L${tailX - 6},${top + h}
    L${cx - w / 2 + 4},${top + h - 1} C${cx - w / 2 - 3},${top + h / 2} ${cx - w / 2 - 2},${top + 16} ${cx - w / 2},${top + 6} Z`;
  return (
    <g className={reduced ? undefined : "reaction-pop"} style={{ transformOrigin: `${tailX}px ${top + h + 18}px` }} pointerEvents="none">
      <path d={body} fill="#000" opacity={0.08} transform="translate(3 4)" />
      <path d={body} fill="#FBF8F0" stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" filter="url(#doodle-pencil)" />
      <text x={cx} y={top + h / 2 + 12} textAnchor="middle" className="doodle-script" fontSize={36} fontWeight={700} fill={TONE[reaction]}>
        {text}
      </text>
    </g>
  );
}

/** A reaction popping up on a lobby seat card. */
export function SeatBubble({ reaction }: { reaction: Reaction }) {
  return (
    <span className="seat-bubble" style={{ color: TONE[reaction] }} aria-hidden="true">
      {REACTION_TEXT[reaction]}
    </span>
  );
}
