import { useEffect, useMemo, useRef, useState } from "react";
import { palette, Speaker, ThemeIcon, tokenInk, type TokenColor, type TokenStage } from "@snakes-doodle/ui-doodle";
import { BoardView } from "../board/BoardView";
import { cellCenter, makeGeom, startSpot } from "../board/geometry";
import { MealLayer } from "../board/Snake";
import { layoutFor } from "../board/layout";
import { sfx } from "../sound";
import { PACE, useGame } from "../store";
import { Caption, DiceButton, Notes, Roster, TitleCard } from "./Hud";
import { LightLayer, type LightTargets } from "./LightLayer";
import { Margins } from "./Margins";
import { TokenLayer } from "./TokenLayer";
import { useViewport } from "./useViewport";
import { WinOverlay } from "./WinOverlay";

// Intro timeline (ms): grid strokes in, hatching fills, snakes and ladders draw, then tokens
// sketch themselves in as outline -> egg -> character.
const INTRO = [
  { at: 0, stage: 0 },
  { at: 1000, stage: 1 },
  { at: 1500, stage: 2 },
  { at: 2300, stage: 3 },
  { at: 2650, stage: 4 },
  { at: 3000, stage: 5 },
  { at: 3300, stage: 6 },
];
const TOKEN_STAGE: TokenStage[] = ["hidden", "hidden", "hidden", "outline", "egg", "full", "full"];

export function GameScreen() {
  const s = useGame();
  const { game, board, art, reducedMotion, introDone } = s;
  const viewport = useViewport();
  const layout = layoutFor(viewport.width, viewport.height);
  const geom = useMemo(() => makeGeom(board.grid, layout.quad, layout.ink), [board.grid, layout.quad, layout.ink]);
  const [intro, setIntro] = useState(reducedMotion ? 6 : 0);
  const [hovered, setHovered] = useState<number | null>(null);
  const animateIntro = useRef(!reducedMotion).current;

  useEffect(() => {
    if (reducedMotion) {
      setIntro(6);
      s.setIntroDone();
      return;
    }
    sfx.unfold();
    const timers = INTRO.map(({ at, stage }) =>
      setTimeout(() => {
        setIntro(stage);
        if (stage === 6) useGame.getState().setIntroDone();
      }, at),
    );
    return () => timers.forEach(clearTimeout);
    // runs once per mounted game
  }, []);

  const current = game?.players.find((p) => p.id === game.turn.playerId);
  const canRoll = !!game && introDone && !s.busy && game.turn.phase === "awaitingRoll";
  const humanCanRoll = canRoll && !!current && !current.isBot;

  // bots roll after a short, human-looking pause
  useEffect(() => {
    if (!canRoll || !current?.isBot) return;
    const t = setTimeout(() => useGame.getState().roll(), PACE.botThinkMin + Math.random() * (PACE.botThinkMax - PACE.botThinkMin));
    return () => clearTimeout(t);
  }, [canRoll, current?.isBot, game?.turn.playerId, game?.log.length]);

  // Space / Enter rolls, unless focus is on some other control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== "Enter") return;
      const el = document.activeElement as HTMLElement | null;
      const onOtherControl = el && el !== document.body && !el.classList.contains("dice-button");
      if (onOtherControl || e.repeat) return;
      e.preventDefault();
      const st = useGame.getState();
      const cur = st.game?.players.find((p) => p.id === st.game?.turn.playerId);
      if (cur && !cur.isBot) st.roll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // what the light layer should light, in sheet coordinates
  const lightTargets = useMemo<LightTargets>(() => {
    const quad = layout.quad;
    const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
    const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
    const span = Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y);
    const tokenAt = (id: string) => {
      if (s.moving?.playerId === id) return geom.toScreen({ c: s.moving.at.c, r: s.moving.at.r });
      const seat = game?.players.findIndex((p) => p.id === id) ?? 0;
      const sq = s.display[id] ?? 0;
      return geom.toScreen(sq > 0 ? cellCenter(board.grid, sq) : startSpot(board.grid, seat));
    };
    const winner = s.showWin ? game?.players.find((p) => p.finishedPlace === 1) : undefined;
    const snake = s.activeSnake !== null ? art.snakes[s.activeSnake] : undefined;
    return {
      night: s.theme === "night" ? 1 : 0,
      // the lamp hangs a little above and left of the board's middle
      lamp: { x: cx - span * 0.08, y: cy - span * 0.12 },
      lampRadius: span * 0.7,
      // between the die tower and the roster, wide enough to take in both
      lamp2: {
        x: (layout.dice.x + layout.roster.x + layout.roster.width / 2) / 2,
        y: (layout.dice.y + layout.roster.y + layout.roster.rowH * 2) / 2,
      },
      lamp2Radius:
        Math.hypot(layout.dice.x - (layout.roster.x + layout.roster.width / 2), layout.dice.y - (layout.roster.y + layout.roster.rowH * 2)) / 2 +
        layout.roster.width * 0.55,
      glow: s.climber ? tokenAt(s.climber) : null,
      shade: snake ? geom.toScreen(snake.centerline[0]!) : null,
      burst: winner ? tokenAt(winner.id) : null,
      unit: geom.unit / layout.ink,
    };
  }, [layout, geom, board.grid, art, game, s.theme, s.climber, s.moving, s.display, s.activeSnake, s.showWin]);

  if (!game || !current) return null;

  const label = !introDone
    ? "getting ready..."
    : game.turn.phase === "gameOver"
      ? "gg"
      : s.handoff
        ? `${game.players.find((p) => p.id === s.handoff)?.name ?? ""}'s turn!`
        : s.busy
        ? "..."
        : current.isBot
          ? `${current.name} is thinking...`
          : `${current.name}, tap to roll`;

  const vb = `0 0 ${layout.width} ${layout.height}`;
  return (
    <main className="game-screen">
      <div className={`sheet-wrap ${s.theme === "night" ? "night" : ""}`}>
      <svg className="sheet" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${board.name} board`}>
        <Margins layout={layout} sunGrin={s.sunGrin} potatoesAwake={s.potatoesAwake} />
        <BoardView
          geom={geom}
          art={art}
          board={board}
          intro={intro}
          animateIntro={animateIntro}
          hovered={hovered}
          onHover={setHovered}
          destination={s.destination}
          trail={s.trail}
          activeSnake={s.activeSnake}
          startLabelLeft={layout.startLabelLeft}
        />
        <TokenLayer
          geom={geom}
          grid={board.grid}
          players={game.players}
          display={s.display}
          moving={s.moving}
          moods={s.moods}
          stage={TOKEN_STAGE[intro] ?? "full"}
          currentId={game.turn.playerId}
          showScribble={introDone && game.turn.phase === "awaitingRoll" && !s.busy}
          turnKey={`${game.turn.playerId}-${game.log.length}`}
          waking={s.handoff}
        />
        {/* above the tokens, so the open mouth covers the token being swallowed */}
        {s.meal && <MealLayer geom={geom} snakes={art.snakes} meal={s.meal} />}
        <Roster layout={layout} game={game} />
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
        <Caption layout={layout} text={s.caption} />
        <Notes layout={layout} notes={s.notes} />
        {intro >= 0 && intro < 6 && !reducedMotion && <TitleCard layout={layout} text={board.name.toLowerCase()} />}
        {s.bigMoment && <TitleCard layout={layout} text={s.bigMoment} />}
        <g
          role="button"
          tabIndex={0}
          aria-label={s.theme === "night" ? "Switch to day" : "Switch to lamp-lit night"}
          aria-pressed={s.theme === "night"}
          className="home-link"
          onClick={s.toggleTheme}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), s.toggleTheme())}
          transform={`translate(${layout.themeToggle.x} ${layout.themeToggle.y}) scale(${layout.themeToggle.s})`}
        >
          <rect x={-22} y={-20} width={44} height={40} fill="transparent" />
          <ThemeIcon night={s.theme === "night"} />
        </g>
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
      <LightLayer targets={lightTargets} sheet={{ width: layout.width, height: layout.height }} reduced={reducedMotion} />
      </div>
      <div className="sr-only" aria-live="polite" role="status">
        {s.announcement}
      </div>
      {s.showWin && <WinOverlay />}
    </main>
  );
}
