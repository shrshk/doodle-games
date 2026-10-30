import { memo } from "react";
import { BASE, HOME, type PlayerState } from "@ludo-doodle/engine";
import { Token, tokenInk, type Mood, type TokenColor, type TokenStage } from "@doodle-games/ui-doodle";
import { progressPoint, type Pt } from "../board/geometry";
import type { Moving } from "../store";

/** How tokens share one square: offsets in cells and a smaller size. */
const SHARE: Record<number, { offsets: [number, number][]; scale: number }> = {
  1: { offsets: [[0, 0]], scale: 1 },
  2: { offsets: [[-0.18, 0.04], [0.18, -0.04]], scale: 0.78 },
  3: { offsets: [[-0.2, 0.08], [0.2, 0.08], [0, -0.14]], scale: 0.68 },
  4: { offsets: [[-0.2, 0.1], [0.2, 0.1], [-0.2, -0.16], [0.2, -0.16]], scale: 0.6 },
};

interface Placed {
  key: string;
  player: PlayerState;
  token: number;
  /** cell centre in board cells */
  at: Pt;
  scale: number;
  lift: number;
  squash: number;
  moving: boolean;
}

/** Where every token is drawn, in board cells. Tokens sharing a track square squeeze up. */
export function placeTokens(players: PlayerState[], display: Record<string, number[]>, moving: Moving | null): Placed[] {
  const out: Placed[] = [];
  const bySquare = new Map<string, Placed[]>();
  for (const player of players) {
    (display[player.id] ?? player.tokens).forEach((progress, token) => {
      const key = `${player.id}-${token}`;
      if (moving && moving.playerId === player.id && moving.token === token) {
        out.push({ key, player, token, at: moving.at, scale: 1, lift: moving.lift, squash: moving.squash, moving: true });
        return;
      }
      const at = progressPoint(player.seat, token, progress);
      const placed = { key, player, token, at, scale: progress === HOME ? 0.5 : 1, lift: 0, squash: 0, moving: false };
      out.push(placed);
      if (progress !== BASE && progress !== HOME) {
        const cell = `${at.x},${at.y}`;
        bySquare.set(cell, [...(bySquare.get(cell) ?? []), placed]);
      }
    });
  }
  for (const group of bySquare.values()) {
    if (group.length < 2) continue;
    const share = SHARE[Math.min(4, group.length)]!;
    group.forEach((p, i) => {
      const [dx, dy] = share.offsets[i % share.offsets.length]!;
      p.at = { x: p.at.x + dx, y: p.at.y + dy };
      p.scale = share.scale;
    });
  }
  return out;
}

type Board = { x: number; y: number; size: number };

/** Sheet position and size for each placed token. */
function toScreen(board: Board, placed: Placed[]) {
  const u = board.size / 15;
  return placed
    .map((p) => {
      // feet a little below the cell centre, so the character stands in its square
      const fx = board.x + p.at.x * u;
      const fy = board.y + (p.at.y + 0.36 * p.scale) * u;
      return { ...p, x: fx, groundY: fy, y: fy - p.lift * u, k: (u * 1.02 * p.scale) / 100 };
    })
    .sort((a, b) => a.groundY - b.groundY);
}

function DrawnToken({ t, mood, stage }: { t: ReturnType<typeof toScreen>[number]; mood: Mood; stage: TokenStage }) {
  const q = t.squash;
  return (
    <g>
      <ellipse cx={t.x} cy={t.groundY} rx={t.k * (t.lift > 0.02 ? 22 : 30)} ry={t.k * 7} fill="#3B2F2A" opacity={t.lift > 0.02 ? 0.12 : 0.2} />
      <g
        className={t.moving ? "token" : "token resting"}
        style={{
          transform: `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) scale(${(t.k * (1 + 0.12 * q)).toFixed(4)}, ${(t.k * (1 - 0.16 * q)).toFixed(4)}) translate(-50px, -96px)`,
          opacity: t.player.resigned ? 0.35 : 1,
        }}
      >
        {/* no wake-up bounce at the handover, unlike Snakes: it would repaint every resting token */}
        <g filter="url(#doodle-sticker)">
          <Token color={t.player.color as TokenColor} mood={t.player.finishedPlace !== undefined ? "happy" : mood} stage={stage} />
        </g>
      </g>
    </g>
  );
}

/**
 * Every token not in flight. Up to 16 sticker-filtered tokens are costly to repaint, so they get a
 * sheet of their own that only changes when a token lands, never on every animation frame.
 */
export const RestingTokens = memo(function RestingTokens({
  board,
  players,
  display,
  movingKey,
  moods,
  stage,
}: {
  board: Board;
  players: PlayerState[];
  display: Record<string, number[]>;
  /** `${playerId}-${token}` of the token in flight, left out here */
  movingKey: string | null;
  moods: Record<string, Mood>;
  stage: TokenStage;
}) {
  const placed = placeTokens(players, display, null).filter((p) => p.key !== movingKey);
  return (
    <g>
      {toScreen(board, placed).map((t) => (
        <DrawnToken key={t.key} t={t} mood={moods[t.player.id] ?? "idle"} stage={stage} />
      ))}
    </g>
  );
});

/** The token in flight, and rings round the tokens a person may move, with their tap targets. */
export function ActiveTokens({
  board,
  players,
  display,
  moving,
  moods,
  currentId,
  pickable,
  onPick,
}: {
  board: Board;
  players: PlayerState[];
  display: Record<string, number[]>;
  moving: Moving | null;
  moods: Record<string, Mood>;
  currentId: string;
  pickable: number[];
  onPick(token: number): void;
}) {
  const u = board.size / 15;
  const placed = toScreen(board, placeTokens(players, display, moving));
  const flying = placed.find((t) => t.moving);
  const picks = placed.filter((t) => t.player.id === currentId && pickable.includes(t.token));
  return (
    <g>
      {flying && <DrawnToken t={flying} mood={moods[flying.player.id] ?? "idle"} stage="full" />}
      {picks.map((t) => (
        <g key={`pick-${t.key}`}>
          <circle
            cx={t.x}
            cy={t.groundY - u * 0.4}
            r={u * 0.62}
            fill="none"
            stroke={tokenInk[t.player.color as TokenColor]}
            strokeWidth={u * 0.07}
            strokeDasharray={`${u * 0.22} ${u * 0.14}`}
            className="pick-ring"
          />
          <circle
            cx={t.x}
            cy={t.groundY - u * 0.4}
            r={u * 0.72}
            fill="transparent"
            className="pick-target"
            role="button"
            tabIndex={0}
            aria-label={`Move token ${t.token + 1}`}
            onClick={() => onPick(t.token)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(t.token))}
          />
        </g>
      ))}
    </g>
  );
}
