# Doodle Snakes & Ladders

Snakes & Ladders that looks like a crayon-and-coloured-pencil doodle on cream paper. Pass-and-play
for 2–4 players, with optional bots.

Status: **Phases 1 and 2** done: the local game, seven inbuilt boards (classic, quick 6x6, snake pit,
ladder climb, spiral notebook, Moksha Patam, big 12x12) with a doodled picker and house rules. See
`docs/HANDOFF.md` for the roadmap.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test
pnpm lint
pnpm build
```

Controls: tap the dice tower, or press Space / Enter. M mutes sound. The moon / sun switches to a
lamp-lit night. Printable A4 boards with cut-out players and a die are in [`exports/boards-a4.pdf`](exports/boards-a4.pdf) (`pnpm print:boards` rebuilds it). On the start page, tap a character to switch it
between player, bot and empty.

Installable as a PWA: open it on a phone and use "Add to Home Screen". It works offline after the
first visit. Test the install with a production build: `pnpm build && pnpm --filter @snakes-doodle/web preview`.

Visual reference: Kevin Ngo's "Chess but it looks like doodles on paper".
