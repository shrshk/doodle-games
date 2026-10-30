import { useCallback, useEffect, useState } from "react";
import { palette, Speaker, tokenInk, type TokenColor, type TokenStage } from "@doodle-games/ui-doodle";
import { BoardView } from "../board/BoardView";
import { sfx } from "../sound";
import { canRollNow, PACE, pickable, useGame } from "../store";
import { DiceButton, Notes, Roster, TitleCard } from "./Hud";
import { ReactionPicker, SheetBubble, SheetReactionButton } from "./Reactions";
import { layoutFor } from "./layout";
import { ActiveTokens, RestingTokens } from "./TokenLayer";
import { useViewport } from "./useViewport";
import { WinOverlay } from "./WinOverlay";

// Intro timeline (ms): the board fades in under its title, then the tokens sketch themselves into
// their bases as outline -> egg -> character. sfx.introMusic resolves at about 1.8 s.
const INTRO = [
  { at: 0, stage: 0 },
  { at: 1000, stage: 1 },
  { at: 1350, stage: 2 },
  { at: 1700, stage: 3 },
  { at: 2100, stage: 4 },
];
const TOKEN_STAGE: TokenStage[] = ["hidden", "outline", "egg", "full", "full"];
const INTRO_DONE = 4;

export function GameScreen() {
  const s = useGame();
  const { game, reducedMotion, introDone } = s;
  const viewport = useViewport();
  const layout = layoutFor(viewport.width, viewport.height);
  const [intro, setIntro] = useState(reducedMotion ? INTRO_DONE : 0);
  const [reactAnchor, setReactAnchor] = useState<DOMRect | null>(null);
  const closeReactions = useCallback(() => setReactAnchor(null), []);

  useEffect(() => {
    if (reducedMotion) {
      setIntro(INTRO_DONE);
      s.setIntroDone();
      return;
    }
    sfx.unfold();
    sfx.introMusic();
    const timers = INTRO.map(({ at, stage }) =>
      setTimeout(() => {
        setIntro(stage);
        if (stage === INTRO_DONE) useGame.getState().setIntroDone();
      }, at),
    );
    return () => timers.forEach(clearTimeout);
    // runs once per mounted game
  }, []);

  const online = s.online;
  // online, a roll or pick opens and the turn timer runs on the clock: tick while in a room
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!online) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [!!online]);

  const current = game?.players.find((p) => p.id === game.turn.playerId);
  const botToRoll = !online && !!game && introDone && !s.busy && game.turn.phase === "awaitingRoll" && !!current?.isBot;
  const humanCanRoll = canRollNow(s, now);
  const picks = pickable(s, now);

  // bots roll after a short, human-looking pause (online, the server rolls for them)
  useEffect(() => {
    if (!botToRoll) return;
    const t = setTimeout(() => useGame.getState().roll(), PACE.botThinkMin + Math.random() * (PACE.botThinkMax - PACE.botThinkMin));
    return () => clearTimeout(t);
  }, [botToRoll, game?.turn.playerId, s.turnNo]);

  // Space / Enter rolls and 1-4 pick a token, unless focus is on some other control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const st = useGame.getState();
      if (/^[1-4]$/.test(e.key)) {
        st.pick(Number(e.key) - 1);
        return;
      }
      if (e.code !== "Space" && e.key !== "Enter") return;
      const el = document.activeElement as HTMLElement | null;
      const onOtherControl = el && el !== document.body && !el.classList.contains("dice-button");
      if (onOtherControl) return;
      e.preventDefault();
      if (canRollNow(st)) st.roll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!game || !current) return null;

  const mine = online && current.id === online.me;
  const away = online?.view?.players[current.id]?.connected === false;
  const secondsLeft = online?.deadline ? Math.max(0, Math.ceil((online.deadline - now) / 1000)) : 0;
  const hurry = (text: string) => (secondsLeft <= 10 ? `${text} (${secondsLeft})` : text);
  const picking = game.turn.phase === "awaitingMove";
  const label =
    online?.status === "reconnecting"
      ? "reconnecting..."
      : !introDone
        ? "getting ready..."
        : game.turn.phase === "gameOver"
          ? "gg"
          : s.handoff
            ? `${game.players.find((p) => p.id === s.handoff)?.name ?? ""}'s turn!`
            : picks.length > 0
              ? online
                ? hurry("tap a token to move")
                : "tap a token to move"
              : s.busy || online?.actSent
                ? "..."
                : current.isBot
                  ? `${current.name} is thinking...`
                  : !online
                    ? `${current.name}, tap to roll`
                    : mine
                      ? humanCanRoll
                        ? hurry("your turn, tap to roll")
                        : "your turn..."
                      : away
                        ? `${current.name} is away`
                        : picking
                          ? `${current.name} is picking...`
                          : `${current.name}'s turn`;
  // roster tags: who this tab is, and who has lost their connection
  const tags = online?.view
    ? Object.fromEntries(game.players.map((p) => [p.id, p.id === online.me ? "you" : online.view!.players[p.id]?.connected === false ? "away" : ""]))
    : undefined;

  const vb = `0 0 ${layout.width} ${layout.height}`;
  return (
    <main className="game-screen">
      <div className={`sheet-wrap ${s.busy ? "busy" : ""}`}>
        {/*
          Stacked sheets with the same viewBox. WebKit repaints a whole SVG when any part of it
          changes, and phones draw SVG filters on the CPU. So the crayon board has a sheet of its own;
          the resting tokens (up to 16, each with a sticker filter) have one that changes only when a
          token lands; and the top sheet holds whatever animates every frame: the token in flight,
          the pick rings, the dice tower and the notes.
        */}
        <svg className="sheet" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ludo board">
          <BoardView {...layout.board} />
          {/* on the still sheet: the sheets above let taps through except on the die and pick rings */}
          {online && (
            <SheetReactionButton x={layout.react.x} y={layout.react.y} s={layout.react.s} open={!!reactAnchor} onOpen={setReactAnchor} />
          )}
          <g
            role="button"
            tabIndex={0}
            aria-label={s.muted ? "Turn sound on (M)" : "Mute sound (M)"}
            aria-pressed={s.muted}
            className="home-link"
            onClick={s.toggleMute}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), s.toggleMute())}
            transform={`translate(${layout.speaker.x} ${layout.speaker.y}) scale(${layout.speaker.s})`}
          >
            <rect x={-24} y={-20} width={48} height={40} fill="transparent" />
            <Speaker muted={s.muted} />
          </g>
          <g
            role="button"
            tabIndex={0}
            aria-label={online ? "Leave the room" : "Back to the start page"}
            className="home-link"
            onClick={s.goHome}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && s.goHome()}
            transform={`translate(${layout.homeLink.x} ${layout.homeLink.y})`}
          >
            <rect x={-58} y={-34} width={116} height={48} fill="transparent" />
            <text textAnchor="middle" className="doodle-hand" fontSize={30} fill={palette.ink}>
              {online ? "← leave" : "← home"}
            </text>
          </g>
        </svg>
        {/* the roster's own sheet: its loop slides at every handover */}
        <svg className="sheet sheet-moving" viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <Roster layout={layout} game={game} tags={tags} />
        </svg>
        <svg className="sheet sheet-moving" viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <RestingTokens
            board={layout.board}
            players={game.players}
            display={s.display}
            movingKey={s.moving ? `${s.moving.playerId}-${s.moving.token}` : null}
            moods={s.moods}
            stage={TOKEN_STAGE[intro] ?? "full"}
          />
        </svg>
        <svg className="sheet sheet-moving" viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <ActiveTokens
            board={layout.board}
            players={game.players}
            display={s.display}
            moving={s.moving}
            moods={s.moods}
            currentId={game.turn.playerId}
            pickable={picks}
            onPick={s.pick}
          />
          <DiceButton
            layout={layout}
            value={s.dice.value}
            rolling={s.dice.rolling}
            rollId={s.dice.rollId}
            reduced={reducedMotion}
            enabled={humanCanRoll}
            label={label}
            color={tokenInk[current.color as TokenColor]}
            onRoll={s.roll}
          />
          <Notes layout={layout} notes={s.notes} />
          {Object.entries(s.reactions).map(([id, r]) => {
            // beside the player's row in the roster
            const row = game.players.findIndex((p) => p.id === id);
            if (row < 0) return null;
            const { x, y, rowH } = layout.roster;
            return <SheetBubble key={r.key} x={x + rowH * 0.5} y={y + row * rowH} reaction={r.reaction} sheetWidth={layout.width} reduced={reducedMotion} />;
          })}
          {intro < INTRO_DONE && !reducedMotion && <TitleCard layout={layout} text="doodle ludo" />}
        </svg>
      </div>
      <div className="sr-only" aria-live="polite" role="status">
        {s.announcement}
      </div>
      {reactAnchor && !s.showWin && <ReactionPicker anchor={reactAnchor} onClose={closeReactions} />}
      {s.showWin && <WinOverlay />}
    </main>
  );
}
