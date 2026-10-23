# Doodle Snakes & Ladders

Snakes & Ladders that looks like a crayon-and-coloured-pencil doodle on cream paper. Pass-and-play
for 2–4 players with optional bots, or online with friends by room code.

Status: **Phases 1, 2 and 4** done: the local game, seven inbuilt boards (classic, quick 6x6, snake
pit, ladder climb, spiral notebook, Moksha Patam, big 12x12) with a doodled picker and house rules,
and online multiplayer on Colyseus. Phase 3 (board import from photos) is next. See
`docs/HANDOFF.md` for the roadmap.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test
pnpm lint
pnpm build
pnpm start      # after build: the game server with the client, http://localhost:2567
pnpm e2e        # Playwright end-to-end tests
```

**Online:** on the start page, "or play with friends online". One person starts a room and shares
the six-letter code or the `/join/CODE` link; the host can fill empty seats with bots and starts the
game. Turns have a 20 s timer (the server rolls if it runs out), and a dropped player has two
minutes to come back to their seat. There is no free-text chat: the speech-bubble button sends a
quick reaction ("nice!", "yay!", "oops!", "lucky!", "nooo", "gg") that pops up over your token. Run it with Docker: `docker build -t snakes-doodle . && docker
run -p 2567:2567 snakes-doodle`. Hosting notes: [`docs/HOSTING.md`](docs/HOSTING.md).

For online play while developing, run the game server beside `pnpm dev`:
`pnpm dev:server` and `node --watch apps/server/dist/index.js`.

Controls: tap the dice tower, or press Space / Enter. M mutes sound. The moon / sun switches to a
lamp-lit night. Printable A4 boards with cut-out players and a die are in [`exports/boards-a4.pdf`](exports/boards-a4.pdf) (`pnpm print:boards` rebuilds it). On the start page, tap a character to switch it
between player, bot and empty.

Installable as a PWA: open it on a phone and use "Add to Home Screen". It works offline after the
first visit. Test the install with a production build: `pnpm build && pnpm --filter @snakes-doodle/web preview`.

Visual reference: Kevin Ngo's "Chess but it looks like doodles on paper".
