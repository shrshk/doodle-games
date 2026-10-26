import { useState } from "react";
import { Bunting, characterName, palette, Speaker, Sun, Token, Whale, type TokenColor } from "@doodle-games/ui-doodle";
import { sfx } from "../sound";
import { useGame, type SlotKind } from "../store";
import { BoardPicker } from "./BoardPicker";
import { HouseRules } from "./HouseRules";

const NEXT_KIND: Record<SlotKind, SlotKind> = { human: "bot", bot: "off", off: "human" };
const KIND_LABEL: Record<SlotKind, string> = { human: "player", bot: "bot", off: "empty" };

export function HomeScreen() {
  const { slots, setSlot, startGame, board, muted, toggleMute, selectBoard, rules, setRules, openOnline } = useGame();
  const [picking, setPicking] = useState(false);
  const active = slots.filter((s) => s.kind !== "off").length;
  const canStart = active >= 2;

  return (
    <main className="home">
      <button type="button" className="sound-toggle" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Turn sound on (M)" : "Mute sound (M)"}>
        <svg viewBox="-24 -20 48 40" aria-hidden="true">
          <Speaker muted={muted} />
        </svg>
      </button>
      <svg className="home-doodles" viewBox="0 0 1000 220" aria-hidden="true" preserveAspectRatio="xMidYMin meet">
        <g transform="translate(90 90) scale(0.7)">
          <Sun />
        </g>
        <g transform="translate(220 0)">
          <Bunting width={600} />
        </g>
        <g transform="translate(900 170) scale(0.42)">
          <Whale />
        </g>
      </svg>

      <h1 className="home-title">
        <span className="write-on-text">doodle snakes &amp; ladders</span>
      </h1>
      <button
        type="button"
        className="home-board"
        onClick={() => {
          sfx.tap();
          setPicking(true);
        }}
        aria-label={`Board: ${board.name}. Change board`}
      >
        board: <span>{board.name.toLowerCase()}</span> <em>change ✎</em>
      </button>
      {picking && (
        <BoardPicker
          current={board.id}
          onPick={(id) => {
            selectBoard(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      <ul className="slots">
        {slots.map((slot, i) => (
          <li key={slot.color} className={`slot ${slot.kind}`} style={{ rotate: `${[-1.5, 1.2, -0.8, 1.6][i]}deg` }}>
            <button
              type="button"
              className="slot-character"
              onClick={() => {
                sfx.tap();
                setSlot(i, { kind: NEXT_KIND[slot.kind] });
              }}
              aria-label={`${characterName[slot.color]}: ${KIND_LABEL[slot.kind]}. Tap to change.`}
            >
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <Token color={slot.color as TokenColor} mood={slot.kind === "off" ? "sleepy" : "idle"} />
              </svg>
              <span className="slot-kind" style={{ color: slot.kind === "bot" ? palette.crayonBlue : undefined }}>
                {KIND_LABEL[slot.kind]}
              </span>
            </button>
            <input
              className="slot-name"
              value={slot.name}
              maxLength={12}
              disabled={slot.kind === "off"}
              aria-label={`${characterName[slot.color]} name`}
              onChange={(e) => setSlot(i, { name: e.target.value })}
            />
          </li>
        ))}
      </ul>

      <p className="home-hint">tap a character to switch between player, bot and empty</p>

      <HouseRules rules={rules} onChange={setRules} />

      <button
        className="slip-button big"
        disabled={!canStart}
        onClick={() => {
          sfx.tap();
          startGame();
        }}
      >
        {canStart ? "play!" : "need 2 players"}
      </button>
      <button
        type="button"
        className="ink-link online-link"
        onClick={() => {
          sfx.tap();
          openOnline();
        }}
      >
        or play with friends online →
      </button>
      <p className="build-id">build {__BUILD_ID__}</p>
    </main>
  );
}
