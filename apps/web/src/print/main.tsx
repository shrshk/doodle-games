// Printable boards: every inbuilt board on its own A4 page, drawn flat with the game's own art,
// plus a page of stand-up tokens and a fold-up die to cut out. White paper, no desk texture: the
// sheet you print on is the paper. `pnpm print:boards` prints this page with headless Chrome.

import { createRoot } from "react-dom/client";
import { boardBlurbs, inbuiltBoards, type Board } from "@snakes-doodle/boards";
import { characterName, palette, PencilDefs, Token, TOKEN_COLORS, type TokenColor } from "@snakes-doodle/ui-doodle";
import { buildBoardArt } from "../board/art";
import { BoardStatic } from "../board/BoardView";
import { makeGeom } from "../board/geometry";
import "../fonts.css";
import "@snakes-doodle/ui-doodle/doodle.css";
import "./print.css";

const SIDE = 1000;

function BoardSheet({ board }: { board: Board }) {
  const art = buildBoardArt(board);
  const { rows, cols } = board.grid;
  // flat, no tilt: printed boards lie on a real table
  const w = cols >= rows ? SIDE : (SIDE * cols) / rows;
  const h = rows >= cols ? SIDE : (SIDE * rows) / cols;
  const x0 = (SIDE - w) / 2;
  const y0 = (SIDE - h) / 2;
  const geom = makeGeom(
    board.grid,
    [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ],
    1.25,
  );
  return (
    <section className="sheet">
      <header>
        <h1>{board.name.toLowerCase()}</h1>
        <p>
          {boardBlurbs[board.id]} · {rows}×{cols} · {board.snakes.length} snakes · {board.ladders.length} ladders
        </p>
      </header>
      <svg className="print-board" viewBox={`-20 -20 ${SIDE + 40} ${SIDE + 40}`}>
        <BoardStatic geom={geom} art={art} board={board} />
      </svg>
      <footer>start below square 1 · land exactly on {rows * cols} to win · climb ladders, slide down snakes</footer>
    </section>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** A cube net (cross shape) with glue tabs; opposite faces add to 7 like a real die. */
function DieNet() {
  const s = 60;
  // faces in the cross: [col, row, value]
  const faces: [number, number, number][] = [
    [1, 0, 2],
    [0, 1, 4],
    [1, 1, 1],
    [2, 1, 3],
    [3, 1, 6],
    [1, 2, 5],
  ];
  const tabs: [number, number, "t" | "b" | "l" | "r"][] = [
    [0, 1, "t"],
    [0, 1, "b"],
    [2, 1, "t"],
    [2, 1, "b"],
    [3, 1, "t"],
    [3, 1, "b"],
    [3, 1, "r"],
  ];
  const tab = (c: number, r: number, side: "t" | "b" | "l" | "r") => {
    const x = c * s;
    const y = r * s;
    const t = 12;
    const d = {
      t: `M${x},${y} L${x + t},${y - t} L${x + s - t},${y - t} L${x + s},${y}`,
      b: `M${x},${y + s} L${x + t},${y + s + t} L${x + s - t},${y + s + t} L${x + s},${y + s}`,
      l: `M${x},${y} L${x - t},${y + t} L${x - t},${y + s - t} L${x},${y + s}`,
      r: `M${x + s},${y} L${x + s + t},${y + t} L${x + s + t},${y + s - t} L${x + s},${y + s}`,
    }[side];
    return <path key={`${c}${r}${side}`} d={d} fill="#F4EBD3" stroke={palette.ink} strokeWidth={1.2} strokeDasharray="4 3" />;
  };
  return (
    <svg viewBox="-20 -20 280 220" className="die-net">
      {tabs.map(([c, r, side]) => tab(c, r, side))}
      {faces.map(([c, r, v]) => (
        <g key={`${c}${r}`} transform={`translate(${c * s} ${r * s})`}>
          <rect width={s} height={s} fill="#FBF8F1" stroke={palette.ink} strokeWidth={1.6} />
          {PIPS[v]!.map(([dx, dy], i) => (
            <circle key={i} cx={s / 2 + dx * 16} cy={s / 2 + dy * 16} r={v === 1 ? 8 : 5.5} fill={v === 1 ? palette.crayonRed : palette.ink} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function CutOutSheet() {
  return (
    <section className="sheet">
      <header>
        <h1>cut, fold and play</h1>
        <p>cut out the players and the die · fold on the dashed lines · glue the shaded tabs</p>
      </header>
      <div className="cutouts">
        {TOKEN_COLORS.map((c: TokenColor) => (
          <figure key={c} className="standee">
            {/* a stand-up token: picture on top, a fold line, then a base flap */}
            <svg viewBox="0 0 120 180">
              <rect x={4} y={4} width={112} height={172} rx={8} fill="none" stroke={palette.ink} strokeWidth={1.4} />
              <g transform="translate(10 6)">
                <Token color={c} />
              </g>
              <line x1={4} y1={118} x2={116} y2={118} stroke={palette.ink} strokeDasharray="5 4" strokeWidth={1.2} />
              <text x={60} y={154} textAnchor="middle" className="doodle-script" fontSize={22} fill={palette.ink}>
                {characterName[c]}
              </text>
            </svg>
          </figure>
        ))}
      </div>
      <div className="die-row">
        <DieNet />
        <ol className="how">
          <li>everyone starts below square 1</li>
          <li>roll the die and walk that many squares</li>
          <li>land on a ladder&apos;s foot: climb up</li>
          <li>land on a snake&apos;s head: slide down</li>
          <li>a 6 means roll again (three 6s lose the turn)</li>
          <li>first to land exactly on the last square wins</li>
        </ol>
      </div>
      <footer>doodle snakes &amp; ladders</footer>
    </section>
  );
}

function Book() {
  return (
    <>
      <PencilDefs />
      {inbuiltBoards.map((b) => (
        <BoardSheet key={b.id} board={b} />
      ))}
      <CutOutSheet />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Book />);
// headless Chrome prints once fonts are in: tell it we are ready
void document.fonts.ready.then(() => document.body.setAttribute("data-ready", "1"));
