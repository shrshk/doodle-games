import { useState } from "react";
import { BASE, HOME, type GameState } from "@ludo-doodle/engine";
import { DiceTower, PaperSlip, palette, Token, tokenInk, type TokenColor } from "@doodle-games/ui-doodle";
import type { Note } from "../store";
import type { SheetLayout } from "./layout";

const toneColor = { red: palette.crayonRed, blue: palette.crayonBlue, ink: palette.ink };

export function DiceButton({
  layout,
  value,
  rolling,
  rollId,
  reduced,
  enabled,
  label,
  color,
  onRoll,
}: {
  layout: SheetLayout;
  value: number | null;
  rolling: boolean;
  rollId: number;
  reduced: boolean;
  enabled: boolean;
  label: string;
  /** current player's crayon colour */
  color: string;
  onRoll(): void;
}) {
  const [focused, setFocused] = useState(false);
  const { x, y, s } = layout.dice;
  return (
    <g>
      <g
        role="button"
        tabIndex={0}
        aria-label={enabled ? "Roll the die (Space or Enter)" : value ? `Die tower, last roll ${value}` : "Die tower"}
        aria-disabled={!enabled}
        className={enabled ? "dice-button ready" : "dice-button"}
        // the tower's visual centre (hopper to tray) sits on the layout point
        transform={`translate(${x} ${y}) scale(${s}) translate(-66 15)`}
        onClick={() => enabled && onRoll()}
        onKeyDown={(e) => enabled && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRoll())}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <rect x={-85} y={-175} width={305} height={320} fill="transparent" />
        {focused && (
          <path
            d="M-86,-150 C-80,-185 120,-182 214,-150 C226,-60 224,60 214,146 C120,160 -40,158 -86,146 C-94,40 -94,-60 -86,-150 Z"
            fill="none"
            stroke={palette.markerOrange}
            strokeWidth={2.6}
            strokeDasharray="7 5"
          />
        )}
        <DiceTower value={value} rolling={rolling} rollId={rollId} reduced={reduced} />
      </g>
      <text
        x={layout.diceLabel.x}
        y={layout.diceLabel.y}
        textAnchor="middle"
        className="doodle-script"
        fontSize={layout.orientation === "portrait" ? 42 : 34}
        fill={enabled ? color : palette.ink}
        opacity={enabled ? 1 : 0.75}
      >
        {label}
      </text>
    </g>
  );
}

/** "2 home · 1 out", or the place once a player has finished. */
function status(p: GameState["players"][number]): string {
  if (p.resigned) return "gave up";
  if (p.finishedPlace) return p.finishedPlace === 1 ? "winner!" : `#${p.finishedPlace}`;
  const home = p.tokens.filter((t) => t === HOME).length;
  const out = p.tokens.filter((t) => t !== BASE && t !== HOME).length;
  if (home === 0 && out === 0) return "all in base";
  return [home && `${home} home`, out && `${out} out`].filter(Boolean).join(" · ");
}

export function Roster({ layout, game, tags }: { layout: SheetLayout; game: GameState; tags?: Record<string, string> }) {
  const { x, y, width, rowH } = layout.roster;
  const portrait = layout.orientation === "portrait";
  const currentIndex = game.players.findIndex((p) => p.id === game.turn.playerId);
  const current = game.players[currentIndex];
  // a pencil loop round the current row; it slides to the next player's row at the handover
  const loop = `M-6,${rowH * 0.45} C0,4 ${width * 0.3},-4 ${width - 6},6 C${width + 6},${rowH * 0.3} ${width + 2},${rowH * 0.8} ${width * 0.6},${rowH - 2} C${width * 0.3},${rowH + 2} 0,${rowH - 4} -2,${rowH * 0.3} C0,${rowH * 0.1} 10,0 22,-1`;
  return (
    <g transform={`translate(${x} ${y})`}>
      {game.turn.phase !== "gameOver" && current && (
        <path
          d={loop}
          className="roster-loop"
          style={{ transform: `translateY(${currentIndex * rowH}px)` }}
          stroke={tokenInk[current.color as TokenColor]}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
      {game.players.map((p, i) => (
        <g key={p.id} transform={`translate(0 ${i * rowH})`}>
          <g transform={`translate(8 ${rowH * 0.06}) scale(${(rowH * 0.0088).toFixed(3)})`}>
            <Token color={p.color as TokenColor} mood={p.finishedPlace ? "happy" : "idle"} />
          </g>
          <text x={rowH * 1.05} y={rowH * 0.62} className="doodle-hand" fontSize={portrait ? 32 : 27} fill={palette.ink}>
            {p.name}
            {(p.isBot || tags?.[p.id]) && (
              <tspan fill={tags?.[p.id] === "away" ? palette.crayonRed : palette.crayonBlue} fontSize={portrait ? 23 : 19}>
                {" "}
                ({p.isBot ? "bot" : tags![p.id]})
              </tspan>
            )}
          </text>
          <text
            x={width - 10}
            y={rowH * 0.62}
            textAnchor="end"
            className="doodle-script roster-status"
            fontSize={portrait ? 32 : 28}
            fill={p.finishedPlace === 1 ? palette.crayonRed : tokenInk[p.color as TokenColor]}
          >
            {status(p)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function Notes({ layout, notes }: { layout: SheetLayout; notes: Note[] }) {
  return (
    <g pointerEvents="none">
      {notes.map((n, i) => {
        const rot = ((n.id * 37) % 7) - 3;
        const w = Math.max(170, n.text.length * 15 + 40);
        return (
          <g
            key={n.id}
            transform={`translate(${layout.notes.x + (i - (notes.length - 1) / 2) * 24} ${layout.notes.y + i * 14}) rotate(${rot})`}
            className="note-in"
          >
            <PaperSlip width={w} height={64}>
              <text y={10} textAnchor="middle" className="doodle-script" fontSize={34} fill={toneColor[n.tone]}>
                {n.text}
              </text>
            </PaperSlip>
          </g>
        );
      })}
    </g>
  );
}

/** Handwritten title that writes itself in over the board as the game starts. */
export function TitleCard({ layout, text }: { layout: SheetLayout; text: string }) {
  const id = `wipe-${text.replace(/\W+/g, "-")}`;
  const w = Math.max(320, text.length * 30 + 60);
  const cx = layout.board.x + layout.board.size / 2;
  return (
    <g transform={`translate(${cx} ${layout.title.y}) rotate(-2)`} pointerEvents="none" className="title-card">
      <PaperSlip width={w} height={96} />
      <clipPath id={id}>
        <rect x={-w / 2} y={-80} width={w} height={160} className="write-on" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <text y={14} textAnchor="middle" className="doodle-script" fontSize={56} fill={palette.ink} fontWeight={700}>
          {text}
        </text>
      </g>
    </g>
  );
}
