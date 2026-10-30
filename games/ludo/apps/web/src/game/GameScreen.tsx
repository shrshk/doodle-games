import { useEffect, useState } from "react";
import { palette, Speaker, tokenInk, type TokenColor, type TokenStage } from "@doodle-games/ui-doodle";
import { BoardView } from "../board/BoardView";
import { sfx } from "../sound";
import { canRollNow, PACE, pickable, useGame } from "../store";
import { DiceButton, Notes, Roster, TitleCard } from "./Hud";
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

  const current = game?.players.find((p) => p.id === game.turn.playerId);
  const botToRoll = !!game && introDone && !s.busy && game.turn.phase === "awaitingRoll" && !!current?.isBot;
  const humanCanRoll = canRollNow(s);
  const picks = pickable(s);

  // bots roll after a short, human-looking pause
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

  const label = !introDone
    ? "getting ready..."
    : game.turn.phase === "gameOver"
      ? "gg"
      : s.handoff
        ? `${game.players.find((p) => p.id === s.handoff)?.name ?? ""}'s turn!`
        : picks.length > 0
          ? "tap a token to move"
          : s.busy
            ? "..."
            : current.isBot
              ? `${current.name} is thinking...`
              : `${current.name}, tap to roll`;

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
            aria-label="Back to the start page"
            className="home-link"
            onClick={s.goHome}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && s.goHome()}
            transform={`translate(${layout.homeLink.x} ${layout.homeLink.y})`}
          >
            <rect x={-58} y={-34} width={116} height={48} fill="transparent" />
            <text textAnchor="middle" className="doodle-hand" fontSize={30} fill={palette.ink}>
              ← home
            </text>
          </g>
        </svg>
        {/* the roster's own sheet: its loop slides at every handover */}
        <svg className="sheet sheet-moving" viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <Roster layout={layout} game={game} />
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
          {intro < INTRO_DONE && !reducedMotion && <TitleCard layout={layout} text="doodle ludo" />}
        </svg>
      </div>
      <div className="sr-only" aria-live="polite" role="status">
        {s.announcement}
      </div>
      {s.showWin && <WinOverlay />}
    </main>
  );
}
