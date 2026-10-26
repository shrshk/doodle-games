# Doodle Games

Board games that look like crayon-and-coloured-pencil doodles on cream paper, for the browser and
as a phone app (PWA). Play on one device, or online with friends by room code.

| Game | Folder | Status |
|---|---|---|
| Snakes & Ladders | [`games/snakes-and-ladders`](games/snakes-and-ladders/README.md) | done: ten boards, bots, online play |
| Ludo | `games/ludo` | next |

Shared by every game: [`packages/ui-doodle`](packages/ui-doodle) (characters, dice tower, paper
slips, margin doodles, crayon filters) and the style frames in `docs/reference/`. Hosting on the
home MacBook Air: [`docs/HOSTING.md`](docs/HOSTING.md).

```sh
pnpm install
pnpm dev        # Snakes & Ladders web app on http://localhost:5173
pnpm test       # every package in every game
pnpm lint
pnpm build
pnpm e2e        # Playwright end-to-end tests
```

A pnpm workspace with Turborepo: each game keeps its own `apps/` (web, server) and `packages/`
(rules, boards, protocol); `packages/` at the root holds what games share.
