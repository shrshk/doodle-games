import { useMemo } from "react";
import { palette, Star, Token, type TokenColor } from "@snakes-doodle/ui-doodle";
import { useGame } from "../store";

export function WinOverlay() {
  const { game, startGame, goHome, reducedMotion } = useGame();
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.4,
        duration: 2.4 + Math.random() * 1.8,
        size: 14 + Math.random() * 16,
        key: i,
      })),
    [],
  );
  if (!game) return null;
  const winner = game.players.find((p) => p.finishedPlace === 1);
  if (!winner) return null;
  const others = game.players.filter((p) => p.id !== winner.id).sort((a, b) => (a.finishedPlace ?? 9) - (b.finishedPlace ?? 9));
  const headline = winner.isBot ? `${winner.name} wins!` : "you win!";

  return (
    <div className="win" role="dialog" aria-modal="true" aria-labelledby="win-title">
      {!reducedMotion && (
        <div className="confetti" aria-hidden="true">
          {confetti.map((c) => (
            <svg
              key={c.key}
              viewBox="-12 -12 24 24"
              width={c.size}
              height={c.size}
              style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
            >
              <Star face={false} />
            </svg>
          ))}
        </div>
      )}
      <div className="win-card">
        <svg className="win-hero" viewBox="0 0 100 100" aria-hidden="true">
          <Token color={winner.color as TokenColor} mood="happy" />
        </svg>
        <h1 id="win-title" className="win-title">
          <span className="write-on-text">{headline}</span>
        </h1>
        <svg className="win-underline" viewBox="0 0 400 30" aria-hidden="true">
          <path
            d="M8,18 C90,8 210,6 300,12 C340,14 370,18 392,10 M40,24 C140,20 250,20 330,22"
            pathLength={1}
            className="doodle-draw"
            style={{ ["--draw-delay" as string]: "700ms" }}
            fill="none"
            stroke={palette.crayonRed}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>
        <p className="win-sub">
          {winner.isBot ? "" : `${winner.name} made it home.`} <span className="gg">gg</span>
        </p>
        <div className="win-stars" aria-label="five stars">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} viewBox="-12 -12 24 24" style={{ animationDelay: `${0.9 + i * 0.15}s` }}>
              <Star face={false} />
            </svg>
          ))}
        </div>
        {others.length > 0 && (
          <p className="win-rest">
            {others.map((p) => `${p.name} ${p.resigned ? "gave up" : p.finishedPlace ? `#${p.finishedPlace}` : `on ${p.position}`}`).join(" · ")}
          </p>
        )}
        <div className="win-actions">
          <button className="slip-button" onClick={startGame} autoFocus>
            again?
          </button>
          <button className="slip-button ghost" onClick={goHome}>
            home
          </button>
        </div>
      </div>
    </div>
  );
}
