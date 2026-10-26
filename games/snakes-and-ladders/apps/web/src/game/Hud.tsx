import { useState } from "react";
import type { GameState } from "@snakes-doodle/engine";
import { DiceTower, PaperSlip, palette, Token, tokenInk, type TokenColor } from "@doodle-games/ui-doodle";
import type { SheetLayout } from "../board/layout";
import { smoothPath } from "../board/projection";
import type { Note } from "../store";

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
        fontSize={layout.orientation === "portrait" ? 40 : 32}
        fill={enabled ? color : palette.ink}
        opacity={enabled ? 1 : 0.7}
      >
        {label}
      </text>
    </g>
  );
}

export function Roster({ layout, game, tags }: { layout: SheetLayout; game: GameState; tags?: Record<string, string> }) {
  const { x, y, width, rowH } = layout.roster;
  const portrait = layout.orientation === "portrait";
  const currentIndex = game.players.findIndex((p) => p.id === game.turn.playerId);
  const current = game.players[currentIndex];
  const loop = smoothPath([
    { x: -6, y: rowH * 0.45 },
    { x: width * 0.3, y: -2 },
    { x: width - 4, y: 6 },
    { x: width + 4, y: rowH * 0.5 },
    { x: width * 0.6, y: rowH - 2 },
    { x: 4, y: rowH - 6 },
    { x: -2, y: rowH * 0.3 },
    { x: 20, y: 0 },
  ]);
  return (
    <g transform={`translate(${x} ${y})`}>
      {game.turn.phase !== "gameOver" && (
        <path
          d={loop}
          className="roster-loop"
          style={{ transform: `translateY(${currentIndex * rowH}px)` }}
          stroke={current ? tokenInk[current.color as TokenColor] : palette.crayonBlue}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
      {game.players.map((p, i) => {
        const status = p.resigned
          ? "gave up"
          : p.finishedPlace
            ? p.finishedPlace === 1
              ? "home! 1st"
              : `home, #${p.finishedPlace}`
            : p.position === 0
              ? "at start"
              : `on ${p.position}`;
        return (
          <g key={p.id} transform={`translate(0 ${i * rowH})`}>
            <g transform={`translate(8 ${rowH * 0.06}) scale(${(rowH * 0.0088).toFixed(3)})`}>
              <Token color={p.color as TokenColor} />
            </g>
            <text x={rowH * 1.05} y={rowH * 0.62} className="doodle-hand" fontSize={portrait ? 30 : 26} fill={palette.ink}>
              {p.name}
              {(p.isBot || tags?.[p.id]) && (
                <tspan fill={tags?.[p.id] === "away" ? palette.crayonRed : palette.crayonBlue} fontSize={portrait ? 22 : 19}>
                  {" "}
                  ({p.isBot ? "bot" : tags![p.id]})
                </tspan>
              )}
            </text>
            <text
              x={width - 10}
              y={rowH * 0.62}
              textAnchor="end"
              className="doodle-script"
              fontSize={portrait ? 32 : 28}
              fill={p.finishedPlace === 1 ? palette.crayonRed : palette.crayonBlue}
            >
              {status}
            </text>
          </g>
        );
      })}
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

/** Handwritten title that writes itself in: the board name at the start, big moments later. */
export function TitleCard({ layout, text, small }: { layout: SheetLayout; text: string; small?: string }) {
  const id = `wipe-${text.replace(/\W+/g, "-")}`;
  const w = Math.max(320, text.length * 30 + 60);
  return (
    <g transform={`translate(${layout.title.x} ${layout.title.y}) rotate(-2)`} pointerEvents="none" className="title-card">
      <PaperSlip width={w} height={small ? 130 : 96} />
      <clipPath id={id}>
        <rect x={-w / 2} y={-80} width={w} height={160} className="write-on" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <text y={small ? -2 : 14} textAnchor="middle" className="doodle-script" fontSize={56} fill={palette.ink} fontWeight={700}>
          {text}
        </text>
        {small && (
          <text y={42} textAnchor="middle" className="doodle-script" fontSize={30} fill={palette.crayonRed}>
            {small}
          </text>
        )}
      </g>
    </g>
  );
}

export function Caption({ layout, text }: { layout: SheetLayout; text: string }) {
  return (
    <text
      key={text}
      x={layout.caption.x}
      y={layout.caption.y}
      textAnchor="middle"
      className="doodle-script caption-in"
      fontSize={layout.orientation === "portrait" ? 40 : 33}
      fill="#6B5A4E"
      aria-hidden="true"
    >
      {text}
    </text>
  );
}
