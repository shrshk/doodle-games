import { useEffect } from "react";
import { Bunting, PencilDefs, startBlinking, Sun, Token, TOKEN_COLORS, Whale } from "@doodle-games/ui-doodle";

/** Every game on the site: its path, its icon in /icons, and a line about it. */
const GAMES = [
  { path: "/snakes/", icon: "/icons/snakes.svg", name: "snakes & ladders", blurb: "ten boards, bots, play online", tilt: -1.5 },
  { path: "/ludo/", icon: "/icons/ludo.svg", name: "ludo", blurb: "ludo king rules, bots, play online", tilt: 1.2 },
];

/** The site's front page: pick a game. */
export function Hub() {
  useEffect(() => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? undefined : startBlinking()), []);
  return (
    <>
      <PencilDefs />
      <div className="paper" aria-hidden="true" />
      <main className="hub">
        <svg className="hub-doodles" viewBox="0 0 1000 220" aria-hidden="true" preserveAspectRatio="xMidYMin meet">
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
        <h1 className="hub-title">
          <span className="write-on-text">doodle games</span>
        </h1>
        <div className="hub-crew" aria-hidden="true">
          {TOKEN_COLORS.map((c) => (
            <svg key={c} viewBox="0 0 100 100">
              <Token color={c} />
            </svg>
          ))}
        </div>
        <p className="hub-hint">pick a game</p>
        <ul className="hub-games">
          {GAMES.map((g) => (
            <li key={g.path} style={{ rotate: `${g.tilt}deg` }}>
              <a className="hub-game" href={g.path}>
                <img src={g.icon} alt="" width={160} height={160} />
                <span className="hub-game-name">{g.name}</span>
                <span className="hub-game-blurb">{g.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="build-id">build {__BUILD_ID__}</p>
      </main>
    </>
  );
}
