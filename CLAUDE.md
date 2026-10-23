# CLAUDE.md

Doodle Snakes & Ladders: a browser Snakes & Ladders game drawn like crayon doodles on paper.
`docs/HANDOFF.md` is the product spec and phase plan; `docs/reference/` holds the style frames.
Work phase by phase and stop at each phase's acceptance criteria.

## Commands

Run from the repo root (pnpm workspaces + Turborepo):

- `pnpm install`
- `pnpm dev` — Vite dev server for `apps/web` on http://localhost:5173
- `pnpm dev:server` — rebuilds the game server on change; run `node --watch apps/server/dist/index.js`
  beside it (port 2567). The dev client talks to `<host>:2567`; `VITE_SERVER_URL` overrides.
- `pnpm start` — the game server after `pnpm build`: serves `apps/web/dist` and the rooms on one port
- `pnpm e2e` — Playwright: a local bot game and a two-browser online game, against a production build
- `pnpm test` — Vitest in every package
- `pnpm typecheck` — `tsc` in every package
- `pnpm lint` — typecheck plus `scripts/check-engine-purity.mjs`
- `pnpm build` — production build of `apps/web` into `apps/web/dist`
- `pnpm balance` — plays 10,000 solo games per inbuilt board and prints median / p90 turns
- `pnpm print:boards` — A4 PDF of every board flat on white plus a cut-out page (tokens, die net),
  written to `exports/boards-a4.pdf` (committed: re-run and commit it after changing a board or the print page); builds `apps/web/print.html` and prints it headless

One package: `pnpm --filter @snakes-doodle/engine test`.

## Where code lives

| Path | What | May import |
|---|---|---|
| `packages/engine` | Pure rules: `createGame`, `reduce(state, action) -> { state, events }`, `validateBoard`, seeded RNG | `boards` only |
| `packages/boards` | Zod `BoardSchema`, `squareToCell` geometry, inbuilt board JSON | `zod` |
| `packages/ui-doodle` | Reusable doodle SVG: characters, dice, paper slips, margin doodles, shared filters | `react` |
| `packages/protocol` | What client and server agree on: room/message types, room codes, seats, `PACE` timings and `turnPlaybackMs` | `engine`, `boards` |
| `apps/web` | Vite + React client: board renderer, screens, Zustand store, event animation | everything |
| `apps/server` | Colyseus 0.18 game server (`GameRoom`), which also serves the built client | `engine`, `boards`, `protocol` |

Rule of thumb: if it decides what happens in the game, it lives in `packages/engine`; if it draws
something, it lives in `apps/web` or `packages/ui-doodle`.

## Engine purity (enforced by `pnpm lint`)

- No `Math.random`, `Date`, timers, DOM, network or `node:` imports in `packages/engine/src`.
  Randomness comes from `rng: { seed, cursor }` in the state (mulberry32, `rngAt(seed, cursor)`).
- `reduce` never mutates its input. A rejected action returns the same state, no events, and an
  `error` code.
- `GameState.track` copies the board's final square and jump map, so a state replays on its own
  (the server in Phase 4 runs the same reducer).
- The client never computes moves. It animates the `events` list, then dispatches
  `ANIMATION_DONE`, which is what passes the turn.

## Rendering conventions

- Board art is built once per board in flat cell coordinates (`apps/web/src/board/art.ts`), seeded
  from `hashString(board.id)`. It is projected through a homography (`projection.ts`) at render
  time, so the wobble is identical on every reload and a layout change never reseeds it.
- Changing the order or number of `rng()` calls in `art.ts` changes every board's look. That is
  fine before boards are shared; after Phase 3, treat it as a breaking change.
- Visual-only randomness (dice flicker, bot delay, confetti) may use `Math.random` in `apps/web`.
- Colours come from `palette` in `ui-doodle`; ink is dark brown `#3B2F2A`, never pure black.
- Every animation must respect `prefers-reduced-motion` (CSS media query plus `reducedMotion` in
  the store, which skips tweens and the intro).
- Pacing: every animation timing lives in `PACE` in `apps/web/src/store.ts`. Tune there, not inline.
- Snakes: `board/snakeKinds.ts` maps a board snake's `style` to a kind (colour, pattern, head shape,
  accessory, tail, thickness). `board/Snake.tsx` draws bodies, heads and the swallow (`MealLayer`,
  rendered above the tokens so the open mouth covers the token being eaten).
- Sound: `apps/web/src/sound.ts` synthesises every effect with Web Audio (no audio files). The
  context unlocks on the first pointer/key press; mute is per-browser in `localStorage`, M toggles.
- PWA: `apps/web/public/` holds `manifest.webmanifest`, `sw.js` and `icons/`. The service worker
  registers in production builds only (`pnpm build && pnpm --filter @snakes-doodle/web preview`).
  Bump `VERSION` in `sw.js` when its caching rules change. PNG icons are rendered from `icon.svg`.
- The die is a dice tower (`ui-doodle/src/DiceTower.tsx`): the drop is CSS keyframes in the
  tower's local units (`tower-drop` in `doodle.css`), `TOWER_MS` sets the roll length and
  `TOWER_HITS` times the wooden knocks in `sound.ts`. Change all three together.
- Intro: the board sheet unfolds from its bottom edge (`board-unfold`) and pieces spring up
  (`pop-up`). 2D on purpose: browsers flatten 3D CSS transforms on SVG elements.
- Light: `game/LightLayer.tsx` is one WebGL canvas over the sheet, in sheet coordinates. It draws
  the lamp-lit night theme (two lamps: the board and the controls), the ladder glow, the snake
  shade and the win burst. Rules (from the Anatomy skill's shader guidance): every amount follows an
  envelope, nothing pops, it renders only while something is lit, DPR capped at 1.5, reduced motion
  gets a still frame, and without WebGL night falls back to a CSS gradient. Never call
  `loseContext()` in its cleanup: React's dev remount reuses the canvas.
- Fonts are bundled in `apps/web/public/fonts/` (OFL); no Google Fonts request.
- Dev builds expose the store as `window.__game` for console and e2e driving (stripped in prod).
- Layouts: `board/layout.ts` has landscape (1600x1000), portrait (1000x1600) and tall-phone
  (1000x2000) sheets;
  the viewBox scales to fit, so positions are in viewBox units.

## Online play (Phase 4)

- The server is authoritative. A client only sends intents (`roll`, and lobby messages); `GameRoom`
  runs `reduce` with the real RNG, then applies `ANIMATION_DONE` at once. The seed and log never
  leave the server (`publicGame()` strips them).
- Each turn is one `turn` message: the events, the state after them, `rollInMs` (when the next roll
  opens, from `turnPlaybackMs`) and `deadlineInMs`. Clients queue turns and play them at their own
  pace (`drain()` in `store.ts`); the synced schema (`apps/server/src/schema.ts`) carries the lobby,
  connection flags and the timer. Positions on screen always come from the message, so a patch
  arriving mid-animation never jumps a token.
- `PACE` lives in `protocol` so the server knows how long a turn plays. Change a timing there and the
  server's wait changes with it. `turnPlaybackMs` must mirror `play()` in `store.ts`; it may err
  short, never long.
- Bots, absent players and the turn timer are rolled for by the server (`scheduleTurn`). A dropped
  client keeps its seat for 120 s (`allowReconnection`); a refresh rejoins through the token in
  `sessionStorage`. An empty room closes after 60 s.
- Room codes are the Colyseus room id (6 characters, no I/O/0/1), claimed through presence.
  `/join/CODE` opens the app on that room; the server answers any unknown path with `index.html`.
- `GameRoom.timing` scales every wait; room tests run whole games in milliseconds, and
  `TIMING_SCALE=0.05` speeds up the server for Playwright.
- Gotchas: in Colyseus 0.18 close code 4000 means a consented leave, so tests simulate a network drop
  with another code; the SDK reconnects on its own unless `room.reconnection.enabled = false`;
  Vitest must use the `threads` pool for the server (Colyseus talks over a child process's IPC
  channel); local presence `sadd` returns nothing, so check `sismember` first.
- Hosting: `docs/HOSTING.md`. One container (`Dockerfile`) serves the page and the game on port 2567.

## Boards

- Inbuilt boards are JSON in `packages/boards/src/inbuilt/`, listed (in picker order) with a
  one-line blurb in `inbuilt/index.ts`. Layouts are hand-tuned, never random.
- A new or changed board must pass `validateBoard` (with and without `chainJumps`) and its balance
  target in `packages/engine/test/boards.test.ts` (10x10: median 25-45 solo turns; other sizes
  scaled there). Tune with `pnpm balance`; shorten snakes near the top first, they dominate.
- Layouts: `boustrophedon`, `spiral` (edges inward, finishes in the middle; draws a dotted path
  guide), `custom`. `theme.paper`: `blank`, `grid`, `ruled`, `kraft`. `labels` puts short words on
  squares (Moksha Patam's virtues at ladder feet, vices at snake heads).
- Anything drawn outside the grid (waiting row, "start") is offset in cells times `sizeFactor`, so it
  sits the same screen distance away on 6x6 and 12x12 boards.
- The last board, house rules and players are remembered per device (`apps/web/src/setup.ts`).

## Tests

- Engine: `packages/engine/test/` — one test per rule toggle (`rules.test.ts`), board validation
  (`validate.test.ts`), fast-check properties for termination, invariants and replay
  (`properties.test.ts`). Pin die rolls with `seedFor([...values])` from `test/helpers.ts`.
- Boards: `packages/boards/src/geometry.test.ts`.
- Rooms: `apps/server/test/room.test.ts` with `@colyseus/testing` (join by code, host-only start,
  out-of-turn roll, timer roll and skip, reconnect, a full game, custom boards, empty-room close).
- E2E: `e2e/*.spec.ts` (Playwright, reduced motion, server at `TIMING_SCALE=0.05`).
- New dependencies need the owner's approval first (see the handoff's stack table).
