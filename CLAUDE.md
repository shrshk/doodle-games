# CLAUDE.md

Doodle Games: browser board games drawn like crayon doodles on paper. One pnpm workspace with
Turborepo, run every command from this root.

| Path | What |
|---|---|
| `games/<game>/` | One game: `apps/web` (Vite + React), `apps/server` (Colyseus), `packages/*` (rules, boards, protocol), `e2e/`, its own `CLAUDE.md` and `docs/` |
| `packages/ui-doodle` | `@doodle-games/ui-doodle`, shared by every game: characters, dice tower, paper slips, margin doodles, crayon filters, `startBlinking` |
| `packages/doodle-sound`, `packages/doodle-rooms` | shared sound effects; what online rooms share (codes unique across games, limits, static serving) |
| `apps/hub` | the "doodle games" page at `/` that lists every game |
| `apps/server` | the production server: every game's rooms, the hub at `/`, each game's client at `/<game>/` |
| `docs/reference/` | the doodle style frames every game follows |
| `docs/HOSTING.md` | the MacBook Air that serves the games |

Each game's `CLAUDE.md` holds its rules; read it before working in that folder. Snakes & Ladders:
`games/snakes-and-ladders/CLAUDE.md`. A new game builds its web app with Vite `base: "/<game>/"`, is
mounted in `apps/server`, and gets a card in `apps/hub`.

## Rules for every game

- A game's rules live in a pure package (no DOM, timers, randomness or IO; seeded RNG in state), so
  client and server replay identically. Drawing lives in the web app or `ui-doodle`.
- Phones (WebKit) re-run an SVG filter whenever anything inside or over the filtered area changes.
  Never animate inside a filtered group, keep looping decorations off filtered art (or pause them
  while something moves), and let springing pieces appear unfiltered first. Measure in Playwright
  WebKit with iPhone emulation before and after (frame times), not by eye.
- New dependencies need the owner's approval first.
- Shared code goes in `packages/`; something only one game uses stays in that game's folder.
- The game server answers a missing file with 404, never the app (iOS icon probes), and the PWA
  icons are PNG only.
