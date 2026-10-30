import { useMemo } from "react";
import { HOME } from "@ludo-doodle/engine";
import { palette, Star, Token, type TokenColor } from "@doodle-games/ui-doodle";
import { useGame } from "../store";

export function WinOverlay() {
  const { game, startGame, goHome, reducedMotion, online, sendOnline } = useGame();
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
  // online only the winner's own tab says "you"; locally, one person against bots does
  const people = game.players.filter((p) => !p.isBot).length;
  const isMe = online ? winner.id === online.me : people === 1 && !winner.isBot;
  const headline = isMe ? "you win!" : `${winner.name} wins!`;

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
          all four of {winner.name}'s tokens are home. <span className="gg">gg</span>
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
            {others
              .map((p) => `${p.name} ${p.resigned ? "gave up" : p.finishedPlace ? `#${p.finishedPlace}` : `${p.tokens.filter((t) => t === HOME).length}/4 home`}`)
              .join(" · ")}
          </p>
        )}
        <div className="win-actions">
          <button className="slip-button" onClick={online ? () => sendOnline("lobby") : startGame} autoFocus>
            {online ? "back to the room" : "again?"}
          </button>
          <button className="slip-button ghost" onClick={goHome}>
            {online ? "leave" : "home"}
          </button>
        </div>
      </div>
    </div>
  );
}
