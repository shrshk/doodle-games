import { useEffect, useMemo, useRef } from "react";
import { boardBlurbs, inbuiltBoards, type Board } from "@snakes-doodle/boards";
import { buildBoardArt } from "../board/art";
import { BoardThumb } from "../board/BoardView";
import { makeGeom } from "../board/geometry";
import type { Quad } from "../board/projection";
import { sfx } from "../sound";

// Thumbnails tilt like the real board, just less.
const THUMB_QUAD: Quad = [
  { x: 34, y: 26 },
  { x: 266, y: 26 },
  { x: 282, y: 280 },
  { x: 18, y: 280 },
];

function Thumb({ board }: { board: Board }) {
  const art = useMemo(() => buildBoardArt(board), [board]);
  const geom = useMemo(() => makeGeom(board.grid, THUMB_QUAD, 1.7), [board]);
  return (
    <svg viewBox="0 0 300 300" aria-hidden="true">
      <BoardThumb geom={geom} art={art} board={board} />
    </svg>
  );
}

/** A notebook page of doodled board thumbnails. Picking one closes the page. */
export function BoardPicker({ current, onPick, onClose }: { current: string; onPick(id: string): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="picker"
      aria-labelledby="picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="picker-page">
        <header className="picker-head">
          <h2 id="picker-title">pick a board</h2>
          <button type="button" className="ink-link" onClick={onClose} aria-label="Close">
            done ✕
          </button>
        </header>
        <ul className="picker-grid">
          {inbuiltBoards.map((b, i) => (
            <li key={b.id} style={{ rotate: `${[-1.2, 0.9, -0.6, 1.3, -1, 0.7, -0.8][i % 7]}deg` }}>
              <button
                type="button"
                className={`picker-card ${b.id === current ? "picked" : ""}`}
                aria-pressed={b.id === current}
                onClick={() => {
                  sfx.tap();
                  onPick(b.id);
                }}
              >
                <Thumb board={b} />
                <span className="picker-name">{b.name.toLowerCase()}</span>
                <span className="picker-blurb">{boardBlurbs[b.id]}</span>
                <span className="picker-meta">
                  {b.grid.rows}×{b.grid.cols} · {b.snakes.length} snakes · {b.ladders.length} ladders
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
