import { memo, useMemo, type CSSProperties } from "react";
import {
  Butterfly,
  CoffeeStain,
  Dandelion,
  Flag,
  Flower,
  GrassTuft,
  Heart,
  Ladybug,
  MiniMushroom,
  palette,
  Snail,
  Sparkle,
  STAR_PATH,
} from "@snakes-doodle/ui-doodle";
import type { Board, Grid } from "@snakes-doodle/boards";
import type { BoardArt, LadderArt } from "./art";
import { cellCenter, sizeFactor, type BoardGeom, type FlatPt } from "./geometry";
import { smoothPath } from "./projection";
import { headPose, SnakeBody, SnakeHead } from "./Snake";
import { kindOf } from "./snakeKinds";

/** 0 grid draws in, 1 hatching fills, 2 snakes and ladders draw, 3+ done */
export type IntroStage = number;

const drawStyle = (delay: number, duration = 700): CSSProperties =>
  ({ "--draw-delay": `${delay}ms`, "--draw-duration": `${duration}ms` }) as CSSProperties;

const GridLayer = memo(function GridLayer({ geom, art, animate }: { geom: BoardGeom; art: BoardArt; animate: boolean }) {
  const proj = (pts: FlatPt[]) => smoothPath(pts.map(geom.toScreen));
  return (
    <g filter="url(#doodle-pencil)" strokeLinecap="round" fill="none">
      {art.lines.map((l, i) => (
        <g key={i}>
          <path
            d={proj(l.main)}
            stroke={palette.ink}
            strokeWidth={geom.unit * 0.033}
            pathLength={1}
            className={animate ? "doodle-draw" : undefined}
            style={animate ? drawStyle(i * 32) : undefined}
          />
          <path
            d={proj(l.ghost)}
            stroke={palette.ink}
            strokeOpacity={0.5}
            strokeWidth={geom.unit * 0.014}
            pathLength={1}
            className={animate ? "doodle-draw" : undefined}
            style={animate ? drawStyle(i * 32 + 120) : undefined}
          />
        </g>
      ))}
    </g>
  );
});

const HatchLayer = memo(function HatchLayer({ geom, art, visible }: { geom: BoardGeom; art: BoardArt; visible: boolean }) {
  const paths = useMemo(
    () =>
      art.hatch.map((cell) => {
        const half = Math.ceil(cell.strokes.length / 2);
        const toD = (strokes: typeof cell.strokes) =>
          strokes
            .map(([a, b]) => {
              const p = geom.toScreen(a);
              const q = geom.toScreen(b);
              return `M${p.x.toFixed(1)},${p.y.toFixed(1)}L${q.x.toFixed(1)},${q.y.toFixed(1)}`;
            })
            .join("");
        return { key: cell.key, a: toD(cell.strokes.slice(0, half)), b: toD(cell.strokes.slice(half)) };
      }),
    [geom, art],
  );
  return (
    <g
      stroke={palette.hatchGreen}
      strokeLinecap="round"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 700ms ease-out" }}
    >
      {paths.map((p) => (
        <g key={p.key}>
          {/* hatching keeps its original weight: the layout's extra ink is for lines, not shading */}
          <path d={p.a} strokeWidth={(geom.unit / geom.ink) * 0.02} strokeOpacity={0.9} />
          <path d={p.b} strokeWidth={(geom.unit / geom.ink) * 0.014} strokeOpacity={0.65} />
        </g>
      ))}
    </g>
  );
});

const NumberLayer = memo(function NumberLayer({ geom, art, grid }: { geom: BoardGeom; art: BoardArt; grid: Grid }) {
  const final = grid.rows * grid.cols;
  const home = geom.toScreen(cellCenter(grid, final));
  const homeScale = geom.scaleAt(cellCenter(grid, final)).sx;
  return (
    <g className="doodle-hand">
      {art.numbers.map((n) => {
        const p = geom.toScreen(n.at);
        const size = geom.scaleAt(n.at).sx * 0.29;
        return (
          <text
            key={n.square}
            x={p.x}
            y={p.y}
            fontSize={size}
            fill={n.red ? palette.crayonRed : palette.crayonBlue}
            // paper-coloured halo keeps the number readable over dense hatching
            stroke="#F4EBD3"
            strokeWidth={size * 0.16}
            strokeLinejoin="round"
            paintOrder="stroke"
            transform={`rotate(${n.rot.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
          >
            {n.square}
          </text>
        );
      })}
      <g transform={`translate(${home.x - homeScale * 0.12} ${home.y + homeScale * 0.12}) scale(${(homeScale / 44).toFixed(3)})`} filter="url(#doodle-crayon)">
        <path d={STAR_PATH} transform="scale(1.2)" fill={palette.pencilYellow} stroke="#C9962A" strokeWidth={0.9} />
      </g>
      <g transform={`translate(${home.x + homeScale * 0.18} ${home.y + homeScale * 0.1}) scale(${(homeScale / 60).toFixed(3)})`}>
        <Flag />
      </g>
    </g>
  );
});

function LadderShape({ geom, ladder, animate, index }: { geom: BoardGeom; ladder: LadderArt; animate: boolean; index: number }) {
  const w = geom.unit;
  const anim = (extra: number) =>
    animate ? { className: "doodle-draw", style: drawStyle(index * 90 + extra, 600) } : {};
  return (
    <g strokeLinecap="round" fill="none" filter="url(#doodle-pencil)">
      {ladder.rails.map((rail, i) => (
        <g key={i}>
          <path d={smoothPath(rail.map(geom.toScreen))} stroke="#7A4A28" strokeWidth={w * 0.05} pathLength={1} {...anim(0)} />
          <path
            d={smoothPath(rail.map((p) => geom.toScreen({ c: p.c + 0.012, r: p.r + 0.01 })))}
            stroke="#C59468"
            strokeWidth={w * 0.016}
            pathLength={1}
            {...anim(80)}
          />
        </g>
      ))}
      {ladder.rungs.map(([a, b], i) => {
        const p = geom.toScreen(a);
        const q = geom.toScreen(b);
        return (
          <path
            key={i}
            d={`M${p.x.toFixed(1)},${p.y.toFixed(1)}L${q.x.toFixed(1)},${q.y.toFixed(1)}`}
            stroke="#7A4A28"
            strokeWidth={w * 0.042}
            pathLength={1}
            {...anim(250 + i * 25)}
          />
        );
      })}
    </g>
  );
}

const PieceLayer = memo(function PieceLayer({
  geom,
  art,
  animate,
  activeSnake,
}: {
  geom: BoardGeom;
  art: BoardArt;
  animate: boolean;
  activeSnake: number | null;
}) {
  return (
    <g>
      {art.ladders.map((l, i) => (
        <g key={`l${l.from}`} className={animate ? "pop-up" : undefined} style={animate ? { animationDelay: `${i * 90}ms` } : undefined}>
          <LadderShape geom={geom} ladder={l} animate={animate} index={i} />
        </g>
      ))}
      {art.snakes.map((s, i) => (
        <g
          key={`s${s.from}`}
          className={[animate ? "pop-up" : "", activeSnake === i ? "snake-gulp" : ""].join(" ")}
          style={animate ? { animationDelay: `${300 + i * 110}ms` } : undefined}
        >
          <SnakeBody geom={geom} snake={s} />
          {activeSnake !== i && <SnakeHead pose={headPose(geom, s)} kind={kindOf(s.style)} mood="idle" unit={geom.unit} />}
        </g>
      ))}
    </g>
  );
});

const DOODLES: Record<string, () => JSX.Element> = {
  flower: () => <Flower color="#D9534A" />,
  "flower-blue": () => <Flower />,
  grass: () => <GrassTuft />,
  mushroom: () => <MiniMushroom />,
  heart: () => <Heart />,
  sparkle: () => <Sparkle />,
  ladybug: () => <Ladybug />,
  snail: () => <Snail />,
  butterfly: () => <Butterfly />,
  dandelion: () => <Dandelion />,
  star: () => <path d={STAR_PATH} fill={palette.pencilYellow} stroke="#C9962A" strokeWidth={1} />,
};

/** Small doodles tucked into a square's lower-right corner; coffee stains sit under the ink. */
function DecorLayer({ geom, board, stains }: { geom: BoardGeom; board: Board; stains: boolean }) {
  return (
    <g pointerEvents="none">
      {(board.decorations ?? []).map((d) => {
        const isStain = d.doodle === "coffee-stain";
        if (isStain !== stains) return null;
        const c = cellCenter(board.grid, d.square);
        const at = isStain ? c : { c: c.c + 0.24, r: c.r + 0.28 };
        const p = geom.toScreen(at);
        const k = geom.scaleAt(at).sx / (isStain ? 70 : d.doodle === "dandelion" ? 120 : 70);
        const draw = isStain ? () => <CoffeeStain /> : DOODLES[d.doodle];
        if (!draw) return null;
        return (
          <g key={`${d.square}-${d.doodle}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${k.toFixed(3)})`}>
            {draw()}
          </g>
        );
      })}
    </g>
  );
}

/** Hand-lettered "start" with an arrow up into square 1, and tape on the sheet's corners. */
function SheetExtras({ geom, grid, labelLeft }: { geom: BoardGeom; grid: Board["grid"]; labelLeft: boolean }) {
  // landscape has margin left of the board; in portrait the board fills the width, so the label
  // sits right of the waiting tokens instead
  const k = sizeFactor(grid);
  const at = (c: number, dr: number) => geom.toScreen({ c: c * k, r: grid.rows + dr * k });
  const label = labelLeft ? at(-1.35, 0.78) : at(2.85, 0.85);
  const size = geom.unit * k * 0.36;
  const a0 = labelLeft ? at(-0.7, 0.5) : at(2.75, 0.55);
  const a1 = labelLeft ? at(-0.45, 0.1) : at(1.6, 0.05);
  const a2 = labelLeft ? at(0.05, -0.25) : at(0.7, -0.25);
  const corners: [number, number, number][] = [
    [0, 0, -38],
    [grid.cols, 0, 38],
    [grid.cols, grid.rows, -36],
    [0, grid.rows, 34],
  ];
  return (
    <g pointerEvents="none">
      <text x={label.x} y={label.y} className="doodle-script" fontSize={size} fill={palette.crayonRed} transform={`rotate(-4 ${label.x} ${label.y})`}>
        start
      </text>
      <path
        d={`M${a0.x},${a0.y} Q${a1.x},${a1.y} ${a2.x},${a2.y} m${-geom.unit * 0.12},${geom.unit * 0.02} l${geom.unit * 0.12},${-geom.unit * 0.02} l${-geom.unit * 0.01},${geom.unit * 0.12}`}
        fill="none"
        stroke={palette.crayonRed}
        strokeWidth={geom.unit * 0.022}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {corners.map(([c, r, rot]) => {
        const p = geom.toScreen({ c, r });
        const w = geom.unit * 0.62;
        const h = geom.unit * 0.2;
        return (
          <rect
            key={`${c},${r}`}
            x={p.x - w / 2}
            y={p.y - h / 2}
            width={w}
            height={h}
            fill="#E9DFC4"
            opacity={0.75}
            stroke="#CDBF9C"
            strokeWidth={0.8}
            transform={`rotate(${rot} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
          />
        );
      })}
    </g>
  );
}

const PAPER_WASH: Record<string, string> = {
  blank: "#F4EBD3",
  grid: "#F4EBD3",
  ruled: "#F6F1E4",
  kraft: "#E3CBA0",
};

/** The board's own sheet: a wash in the theme's paper colour, with ruled or graph lines. */
function SheetPaper({ geom, board, visible }: { geom: BoardGeom; board: Board; visible: boolean }) {
  const { rows, cols } = board.grid;
  const paper = board.theme?.paper ?? "blank";
  const outline = [
    { c: 0, r: 0 },
    { c: cols, r: 0 },
    { c: cols, r: rows },
    { c: 0, r: rows },
  ].map(geom.toScreen);
  const line = (a: FlatPt, b: FlatPt) => {
    const p = geom.toScreen(a);
    const q = geom.toScreen(b);
    return `M${p.x.toFixed(1)},${p.y.toFixed(1)}L${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  };
  let lines = "";
  if (paper === "ruled") for (let r = 1 / 3; r < rows; r += 1 / 3) lines += line({ c: 0, r }, { c: cols, r });
  if (paper === "grid") {
    for (let r = 0.25; r < rows; r += 0.25) lines += line({ c: 0, r }, { c: cols, r });
    for (let c = 0.25; c < cols; c += 0.25) lines += line({ c, r: 0 }, { c, r: rows });
  }
  return (
    <g style={{ opacity: visible ? 1 : 0, transition: "opacity 700ms ease-out" }} pointerEvents="none">
      <path d={`M${outline.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z`} fill={PAPER_WASH[paper] ?? PAPER_WASH.blank} opacity={0.8} />
      {lines && <path d={lines} stroke="#8AA9D6" strokeWidth={geom.unit * 0.008} opacity={paper === "grid" ? 0.35 : 0.55} />}
      {paper === "ruled" && <path d={line({ c: 0.18, r: 0 }, { c: 0.18, r: rows })} stroke="#E08A8A" strokeWidth={geom.unit * 0.012} opacity={0.7} />}
    </g>
  );
}

/** Short words on squares (Moksha Patam's virtues and vices), coloured by what the square does. */
function LabelLayer({ geom, board }: { geom: BoardGeom; board: Board }) {
  const ladders = new Set(board.ladders.map((l) => l.from));
  return (
    <g className="doodle-script" pointerEvents="none">
      {(board.labels ?? []).map(({ square, text }) => {
        const c = cellCenter(board.grid, square);
        const at = { c: c.c, r: c.r + 0.4 };
        const p = geom.toScreen(at);
        const sx = geom.scaleAt(at).sx;
        const size = sx * Math.min(0.28, 1.9 / Math.max(6, text.length));
        const halo = PAPER_WASH[board.theme?.paper ?? "blank"] ?? PAPER_WASH.blank;
        return (
          <text
            key={square}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            fontSize={size}
            fontWeight={700}
            fill={ladders.has(square) ? "#2F6F2A" : "#B8352D"}
            stroke={halo}
            strokeWidth={size * 0.3}
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}

/** Faint dotted pencil line through the squares in order, for layouts whose route is not obvious. */
function PathGuide({ geom, grid }: { geom: BoardGeom; grid: Grid }) {
  const total = grid.rows * grid.cols;
  const pts = Array.from({ length: total }, (_, i) => geom.toScreen(cellCenter(grid, i + 1)));
  return (
    <path
      d={`M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}`}
      fill="none"
      stroke="#6C8FD0"
      strokeWidth={geom.unit * 0.02}
      strokeDasharray={`${geom.unit * 0.02} ${geom.unit * 0.12}`}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.6}
      pointerEvents="none"
    />
  );
}

/** A still, small drawing of a board: paper, shading, grid, snakes and ladders. For the picker. */
export const BoardThumb = memo(function BoardThumb({ geom, art, board }: { geom: BoardGeom; art: BoardArt; board: Board }) {
  return (
    <g>
      <SheetPaper geom={geom} board={board} visible />
      <HatchLayer geom={geom} art={art} visible />
      {board.grid.layout === "spiral" && <PathGuide geom={geom} grid={board.grid} />}
      <GridLayer geom={geom} art={art} animate={false} />
      <PieceLayer geom={geom} art={art} animate={false} activeSnake={null} />
    </g>
  );
});

/** The whole board as a still drawing (paper, shading, grid, numbers, words, doodles, snakes and
 * ladders): the printable sheets use it. */
export const BoardStatic = memo(function BoardStatic({ geom, art, board }: { geom: BoardGeom; art: BoardArt; board: Board }) {
  const grid = board.grid;
  return (
    <g>
      <SheetPaper geom={geom} board={board} visible />
      <DecorLayer geom={geom} board={board} stains />
      <HatchLayer geom={geom} art={art} visible />
      {grid.layout === "spiral" && <PathGuide geom={geom} grid={grid} />}
      <GridLayer geom={geom} art={art} animate={false} />
      <NumberLayer geom={geom} art={art} grid={grid} />
      <DecorLayer geom={geom} board={board} stains={false} />
      <PieceLayer geom={geom} art={art} animate={false} activeSnake={null} />
      <LabelLayer geom={geom} board={board} />
    </g>
  );
});

/** Orange corner brackets around a hovered cell. */
function Brackets({ geom, grid, square }: { geom: BoardGeom; grid: Grid; square: number }) {
  const c = cellCenter(grid, square);
  const arm = 0.22;
  const inset = 0.42;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const d = corners
    .map(([sc, sr]) => {
      const corner = geom.toScreen({ c: c.c + sc * inset, r: c.r + sr * inset });
      const a = geom.toScreen({ c: c.c + sc * (inset - arm), r: c.r + sr * inset });
      const b = geom.toScreen({ c: c.c + sc * inset, r: c.r + sr * (inset - arm) });
      return `M${a.x.toFixed(1)},${a.y.toFixed(1)}L${corner.x.toFixed(1)},${corner.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    })
    .join("");
  return <path d={d} stroke={palette.markerOrange} strokeWidth={geom.unit * 0.035} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

/** Hand-drawn orange circle with a leaf, marking where a move will land. */
function LeafCircle({ geom, grid, square }: { geom: BoardGeom; grid: Grid; square: number }) {
  const c = cellCenter(grid, square);
  const p = geom.toScreen(c);
  const { sx, sy } = geom.scaleAt(c);
  const rx = sx * 0.33;
  const ry = sy * 0.33;
  const pts = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - 1.2;
    const wob = 1 + 0.04 * Math.sin(i * 1.7);
    return { x: p.x + Math.cos(a) * rx * wob, y: p.y + Math.sin(a) * ry * wob };
  });
  const leaf = { x: p.x + rx * 0.62, y: p.y - ry * 0.85 };
  return (
    <g className="doodle-pop-in">
      <path d={smoothPath(pts)} stroke={palette.markerOrange} strokeWidth={geom.unit * 0.032} fill={palette.markerOrange} fillOpacity={0.12} strokeLinecap="round" />
      <path
        d={`M${leaf.x},${leaf.y} q${sx * 0.06},${-sx * 0.13} ${sx * 0.17},${-sx * 0.1} q${-sx * 0.04},${sx * 0.11} ${-sx * 0.17},${sx * 0.1} Z`}
        fill="#A8CC8C"
        stroke={palette.leaf}
        strokeWidth={geom.unit * 0.014}
      />
    </g>
  );
}

export interface BoardViewProps {
  geom: BoardGeom;
  art: BoardArt;
  board: Board;
  intro: IntroStage;
  animateIntro: boolean;
  onHover(square: number | null): void;
  activeSnake: number | null;
  startLabelLeft: boolean;
}

/**
 * The board itself: paper, hatching, grid, numbers, snakes and ladders. It only changes on intro
 * stages and when a snake opens its mouth, so it is memoized and drawn in the still layer; anything
 * that moves every frame goes in BoardMarks instead (see GameScreen).
 */
export const BoardView = memo(function BoardView(props: BoardViewProps) {
  const { geom, art, board, intro, animateIntro, onHover, activeSnake, startLabelLeft } = props;
  const grid = board.grid;
  const cells = useMemo(() => {
    const out: { square: number; d: string }[] = [];
    for (let square = 1; square <= grid.rows * grid.cols; square++) {
      const c = cellCenter(grid, square);
      const pts = [
        { c: c.c - 0.5, r: c.r - 0.5 },
        { c: c.c + 0.5, r: c.r - 0.5 },
        { c: c.c + 0.5, r: c.r + 0.5 },
        { c: c.c - 0.5, r: c.r + 0.5 },
      ].map(geom.toScreen);
      out.push({ square, d: `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z` });
    }
    return out;
  }, [geom, grid]);

  // pop-up book: the whole sheet hinges up from its bottom edge on the first draw
  const hinge = geom.toScreen({ c: grid.cols / 2, r: grid.rows });
  return (
    <g className={animateIntro ? "board-unfold" : undefined} style={animateIntro ? { transformOrigin: `${hinge.x.toFixed(1)}px ${hinge.y.toFixed(1)}px` } : undefined}>
      {/* the blank sheet is there from the first frame, so the unfold has a page to lift */}
      <SheetPaper geom={geom} board={board} visible />
      {intro >= 1 && <DecorLayer geom={geom} board={board} stains />}
      <HatchLayer geom={geom} art={art} visible={intro >= 1} />
      {intro >= 1 && grid.layout === "spiral" && <PathGuide geom={geom} grid={grid} />}
      <GridLayer geom={geom} art={art} animate={animateIntro} />
      {intro >= 1 && <NumberLayer geom={geom} art={art} grid={grid} />}
      {intro >= 1 && <DecorLayer geom={geom} board={board} stains={false} />}
      {intro >= 1 && <SheetExtras geom={geom} grid={grid} labelLeft={startLabelLeft} />}
      <g onPointerLeave={() => onHover(null)}>
        {cells.map((c) => (
          <path key={c.square} d={c.d} fill="transparent" onPointerEnter={(e) => e.pointerType === "mouse" && onHover(c.square)} />
        ))}
      </g>
      {intro >= 2 && <PieceLayer geom={geom} art={art} animate={animateIntro} activeSnake={activeSnake} />}
      {/* above the snakes and ladders so the words stay readable */}
      {intro >= 2 && <LabelLayer geom={geom} board={board} />}
    </g>
  );
});

/** What changes on the board while a token moves: the hop trail, the destination ring, the hovered square. */
export function BoardMarks({ geom, grid, hovered, destination, trail }: { geom: BoardGeom; grid: Grid; hovered: number | null; destination: number | null; trail: FlatPt[] }) {
  return (
    <g pointerEvents="none">
      {hovered !== null && <Brackets geom={geom} grid={grid} square={hovered} />}
      {destination !== null && destination > 0 && <LeafCircle geom={geom} grid={grid} square={destination} />}
      {trail.map((t, i) => {
        const p = geom.toScreen(t);
        return <circle key={i} cx={p.x} cy={p.y} r={geom.unit * 0.032} fill={palette.crayonRed} opacity={0.85} />;
      })}
    </g>
  );
}
