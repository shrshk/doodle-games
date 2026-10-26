import type { Grid } from "@snakes-doodle/boards";
import type { PlayerState } from "@snakes-doodle/engine";
import { Token, tokenInk, type Mood, type TokenColor, type TokenStage } from "@doodle-games/ui-doodle";
import { cellCenter, sizeFactor, startSpot, type BoardGeom, type FlatPt } from "../board/geometry";
import { smoothPath } from "../board/projection";
import type { Moving } from "../store";

const SHARE: Record<number, { offsets: [number, number][]; scale: number }> = {
  1: { offsets: [[0, 0]], scale: 1 },
  2: { offsets: [[-0.2, 0.04], [0.2, -0.04]], scale: 0.8 },
  3: { offsets: [[-0.22, 0.08], [0.22, 0.08], [0, -0.14]], scale: 0.7 },
  4: { offsets: [[-0.2, 0.1], [0.2, 0.1], [-0.2, -0.16], [0.2, -0.16]], scale: 0.62 },
};

interface Placed {
  player: PlayerState;
  seat: number;
  feet: FlatPt;
  scale: number;
  lift: number;
  squash: number;
  moving: boolean;
  hidden: boolean;
}

/** Pencil loop around the player whose turn it is, in that player's crayon colour. */
function Scribble({ x, y, rx, ry, width, color }: { x: number; y: number; rx: number; ry: number; width: number; color: string }) {
  const pts = Array.from({ length: 30 }, (_, i) => {
    const a = -2.2 + (i / 26) * Math.PI * 2;
    const grow = 1 + i * 0.006;
    return { x: x + Math.cos(a) * rx * grow, y: y + Math.sin(a) * ry * grow };
  });
  const end = pts[pts.length - 1]!;
  pts.push({ x: end.x - rx * 0.35, y: end.y - ry * 0.45 });
  return (
    <path
      d={smoothPath(pts)}
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      opacity={0.85}
      pathLength={1}
      className="doodle-draw"
      style={{ ["--draw-duration" as string]: "450ms" }}
    />
  );
}

export function TokenLayer({
  geom,
  grid,
  players,
  display,
  moving,
  moods,
  stage,
  currentId,
  showScribble,
  turnKey,
  waking,
}: {
  geom: BoardGeom;
  grid: Grid;
  players: PlayerState[];
  display: Record<string, number>;
  moving: Moving | null;
  moods: Record<string, Mood>;
  stage: TokenStage;
  currentId: string;
  showScribble: boolean;
  turnKey: string;
  /** player whose token does a wake-up bounce while the turn is handed over */
  waking: string | null;
}) {
  const bySquare = new Map<number, PlayerState[]>();
  players.forEach((p) => {
    if (moving?.playerId === p.id) return;
    const sq = display[p.id] ?? 0;
    if (sq > 0) bySquare.set(sq, [...(bySquare.get(sq) ?? []), p]);
  });

  const placed: Placed[] = players.map((player, seat) => {
    if (moving?.playerId === player.id) {
      const sc = moving.scale ?? 1;
      return {
        player,
        seat,
        feet: { c: moving.at.c, r: moving.at.r + 0.36 * sc },
        scale: sc,
        lift: moving.lift,
        squash: moving.squash,
        moving: true,
        hidden: !!moving.hidden,
      };
    }
    const sq = display[player.id] ?? 0;
    if (sq === 0) {
      const s = startSpot(grid, seat);
      return { player, seat, feet: { c: s.c, r: s.r + 0.28 * sizeFactor(grid) }, scale: 0.85, lift: 0, squash: 0, moving: false, hidden: false };
    }
    const group = bySquare.get(sq)!;
    const share = SHARE[group.length] ?? SHARE[4]!;
    const [dc, dr] = share.offsets[group.indexOf(player)] ?? [0, 0];
    const c = cellCenter(grid, sq);
    return { player, seat, feet: { c: c.c + dc, r: c.r + 0.36 + dr }, scale: share.scale, lift: 0, squash: 0, moving: false, hidden: false };
  });

  const screen = placed
    .map((p) => {
      const base = geom.toScreen(p.feet);
      const { sx, sy } = geom.scaleAt(p.feet);
      // big-square boards (6x6) would make giant tokens: cap a token at about one 10x10 square
      const width = Math.min(sx * 1.02, geom.unit * sizeFactor(grid) * 1.15) * p.scale;
      return { ...p, x: base.x, y: base.y - p.lift * sy, k: width / 100, groundY: base.y };
    })
    .sort((a, b) => a.groundY - b.groundY);

  return (
    <g>
      {screen.map((t) => {
        const isCurrent = t.player.id === currentId;
        const q = t.squash;
        return (
          <g key={t.player.id}>
            {!t.hidden && (
              <ellipse
                cx={t.x}
                cy={t.groundY}
                rx={t.k * (t.lift > 0.02 ? 22 : 30)}
                ry={t.k * 7}
                fill="#3B2F2A"
                opacity={t.lift > 0.02 ? 0.12 : 0.2}
              />
            )}
            <g
              className={t.moving ? "token" : "token resting"}
              style={{
                transform: `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) scale(${(t.k * (1 + 0.12 * q)).toFixed(4)}, ${(t.k * (1 - 0.16 * q)).toFixed(4)}) translate(-50px, -96px)`,
                opacity: t.hidden ? 0 : t.player.resigned ? 0.35 : 1,
              }}
            >
              <g className={waking === t.player.id ? "token-wake" : undefined} filter="url(#doodle-sticker)">
                <Token color={t.player.color as TokenColor} mood={moods[t.player.id] ?? "idle"} stage={stage} />
              </g>
            </g>
            {isCurrent && showScribble && (
              <Scribble
                key={turnKey}
                x={t.x}
                y={t.y - t.k * 48}
                rx={t.k * 56}
                ry={t.k * 60}
                width={geom.unit * 0.028}
                color={tokenInk[t.player.color as TokenColor]}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
