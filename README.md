# Doodle Games

Board games that look like crayon-and-coloured-pencil doodles on cream paper, for the browser and
as a phone app (PWA). Play on one device, or online with friends by room code.
Live at https://games.shirishve.com: a page listing the games, each under its own path.

| Game | Folder | Status |
|---|---|---|
| Snakes & Ladders | [`games/snakes-and-ladders`](games/snakes-and-ladders/README.md) | done: ten boards, bots, online play |
| Ludo | [`games/ludo`](games/ludo/docs/PLAN.md) | done: Ludo King rules, bots, online play |

Shared by every game: [`packages/ui-doodle`](packages/ui-doodle) (characters, dice tower, paper
slips, margin doodles, crayon filters), [`packages/doodle-sound`](packages/doodle-sound) (synthesised sound effects),
[`packages/doodle-rooms`](packages/doodle-rooms) (what online rooms share) and the style frames in `docs/reference/`. Hosting on the
home MacBook Air: [`docs/HOSTING.md`](docs/HOSTING.md).

```sh
pnpm install
pnpm dev        # Snakes & Ladders web app on http://localhost:5173
pnpm dev:ludo   # Ludo web app on http://localhost:5176 (local play)
pnpm dev:ludo-server  # Ludo server, page included, on http://localhost:2568 (build the web app first)
pnpm test       # every package in every game
pnpm lint
pnpm build
pnpm e2e        # Playwright end-to-end tests, against the production server
pnpm start      # the production server (after pnpm build): hub + both games on :2567
```

A pnpm workspace with Turborepo: each game keeps its own `apps/` (web, server) and `packages/`
(rules, boards, protocol); `packages/` at the root holds what games share, and `apps/` the hub page
(`apps/hub`) and the production server that hosts every game (`apps/server`).
