import { useEffect, useRef, useState } from "react";
import { inbuiltBoards } from "@snakes-doodle/boards";
import { CODE_LENGTH, NAME_MAX, SEATS, normalizeCode, type RoomPlayer, type Seat } from "@snakes-doodle/protocol";
import { characterName, palette, Token, type TokenColor } from "@snakes-doodle/ui-doodle";
import { joinLink } from "../net/online";
import { sfx } from "../sound";
import { useGame } from "../store";
import { ReactionButton, SeatBubble } from "./Reactions";

const TILT = [-1.5, 1.2, -0.8, 1.6];

/** Play with friends: start a room or join one by code, then wait in the room's lobby. */
export function OnlineScreen({ initialCode = "" }: { initialCode?: string }) {
  const online = useGame((s) => s.online);
  const view = online?.view;
  return (
    <main className="home online">
      <h1 className="home-title">
        <span className="write-on-text">play with friends</span>
      </h1>
      {view && view.phase === "lobby" ? <Lobby /> : <Doorway initialCode={initialCode} />}
    </main>
  );
}

/** Not in a room yet: a name, then start a room or type a friend's code. */
function Doorway({ initialCode }: { initialCode: string }) {
  const { online, slots, board, hostOnline, joinOnline, goHome } = useGame();
  const firstHuman = slots.find((s) => s.kind === "human") ?? slots[0]!;
  const [name, setName] = useState(firstHuman.name);
  const [code, setCode] = useState(normalizeCode(initialCode));
  const busy = online?.status === "connecting" || online?.status === "in-room";
  const codeReady = code.length === CODE_LENGTH;

  // a /join/ABC123 link: go straight in, once (StrictMode runs effects twice in dev)
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || normalizeCode(initialCode).length !== CODE_LENGTH) return;
    autoJoined.current = true;
    void joinOnline(normalizeCode(initialCode), name);
  }, []);

  return (
    <div className="doorway">
      <label className="online-name">
        <span>your name</span>
        <input className="slot-name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </label>

      <section className="door">
        <h2>start a room</h2>
        <p className="home-hint">
          on <b>{board.name.toLowerCase()}</b>, with your house rules. Friends join with a code.
        </p>
        <button
          type="button"
          className="slip-button"
          disabled={busy}
          onClick={() => {
            sfx.tap();
            void hostOnline(name);
          }}
        >
          {online?.status === "connecting" ? "opening..." : "start a room"}
        </button>
      </section>

      <section className="door">
        <h2>join a room</h2>
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!codeReady || busy) return;
            sfx.tap();
            void joinOnline(code, name);
          }}
        >
          <input
            className="code-input"
            value={code}
            placeholder="ABC234"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={CODE_LENGTH + 2}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH))}
          />
          <button type="submit" className="slip-button" disabled={!codeReady || busy}>
            join
          </button>
        </form>
      </section>

      {online?.error && (
        <p className="online-error" role="alert">
          {online.error}
        </p>
      )}
      <button type="button" className="ink-link" onClick={goHome}>
        ← back
      </button>
    </div>
  );
}

/** In a room, before the game: seats, bots, the code to share, and the host's start button. */
function Lobby() {
  const { online, sendOnline, leaveOnline, reactions } = useGame();
  const view = online!.view!;
  const me = online!.me;
  const isHost = view.hostId === me;
  const host = view.players[view.hostId];
  const mine = view.players[me];
  const bySeat = new Map<Seat, RoomPlayer>(Object.values(view.players).map((p) => [p.color, p]));
  const boardName = (inbuiltBoards.find((b) => b.id === view.boardId)?.name ?? (JSON.parse(view.boardJson) as { name: string }).name).toLowerCase();
  const [name, setName] = useState(mine?.name ?? "");
  const [copied, setCopied] = useState(false);
  const canStart = isHost && view.turnOrder.length >= 2;

  const share = async () => {
    sfx.tap();
    const link = joinLink(view.code);
    try {
      if (navigator.share) await navigator.share({ title: "doodle snakes & ladders", text: `join my game: ${view.code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // the share sheet was dismissed, or the clipboard is blocked: the code is on screen anyway
    }
  };

  return (
    <div className="lobby">
      <div className="room-code" aria-label={`Room code ${view.code.split("").join(" ")}`}>
        <span className="room-code-label">room code</span>
        <span className="room-code-letters">{view.code}</span>
        <button type="button" className="ink-link" onClick={share}>
          {copied ? "link copied ✓" : "share link"}
        </button>
      </div>
      <p className="home-hint">
        board: <b>{boardName}</b> · {view.turnSeconds}s turns
        {view.spectators > 0 && ` · ${view.spectators} watching`}
      </p>

      <ul className="slots">
        {SEATS.map((seat, i) => {
          const p = bySeat.get(seat);
          const isMe = p?.id === me;
          const kind = !p ? "empty" : p.isBot ? "bot" : isMe ? "you" : p.connected ? "player" : "away";
          return (
            <li key={seat} className={`slot ${p ? "human" : "off"} ${isMe ? "me" : ""}`} style={{ rotate: `${TILT[i]}deg` }}>
              {p && reactions[p.id] && <SeatBubble key={reactions[p.id]!.key} reaction={reactions[p.id]!.reaction} />}
              <button
                type="button"
                className="slot-character"
                disabled={!!p || !mine}
                onClick={() => {
                  sfx.tap();
                  sendOnline("seat", { seat });
                }}
                aria-label={p ? `${characterName[seat]}: ${p.name}` : `${characterName[seat]}: empty. Tap to sit here.`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <Token color={seat as TokenColor} mood={p ? (p.connected ? "idle" : "sleepy") : "sleepy"} />
                </svg>
                <span className="slot-kind" style={{ color: kind === "bot" || kind === "you" ? palette.crayonBlue : kind === "away" ? palette.crayonRed : undefined }}>
                  {kind}
                </span>
              </button>
              {isMe ? (
                <input
                  className="slot-name"
                  value={name}
                  maxLength={NAME_MAX}
                  aria-label="Your name"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => sendOnline("name", { name })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <span className="slot-name static">{p ? p.name : "—"}</span>
              )}
              {isHost && !p && (
                <button type="button" className="ink-link small" onClick={() => sendOnline("addBot", { seat })}>
                  + bot
                </button>
              )}
              {isHost && p?.isBot && (
                <button type="button" className="ink-link small" onClick={() => sendOnline("removeBot", { seat })}>
                  remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="home-hint">
        {!mine
          ? "the seats are full, you are watching"
          : isHost
            ? "tap an empty character to sit there, or give it a bot"
            : `tap an empty character to sit there · ${host?.name ?? "the host"} starts the game`}
      </p>

      {isHost && (
        <button
          className="slip-button big"
          disabled={!canStart}
          onClick={() => {
            sfx.tap();
            sendOnline("start");
          }}
        >
          {canStart ? "start!" : "waiting for players"}
        </button>
      )}
      {online!.status === "reconnecting" && <p className="online-error">reconnecting...</p>}
      <button type="button" className="ink-link" onClick={leaveOnline}>
        ← leave the room
      </button>
      <ReactionButton />
      <p className="sr-only" aria-live="polite">
        {`In the room: ${Object.values(view.players)
          .map((p) => `${p.name}${p.isBot ? " (bot)" : ""}`)
          .join(", ")}.`}
      </p>
    </div>
  );
}
