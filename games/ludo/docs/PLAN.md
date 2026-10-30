# Doodle Ludo — plan

Ludo in the same crayon-doodle look as Snakes & Ladders, for the browser and as a phone app (PWA).
Rules follow **Ludo King's classic mode** (owner's choice, 2026-10-30).

## Rules (Ludo King classic)

- 2–4 players, each with 4 tokens in their base. Any seat can be a bot. Seats go clockwise: red
  (mushroom), yellow (bee), orange (owl), indigo (blob). Two players sit opposite each other.
- The track has 52 squares. Each colour starts on its own start square and runs 51 squares round the
  board, then 5 squares up its home column, then home (57 steps from the start square).
- A 6 brings a token out of the base onto the start square.
- A 6 gives another roll. A third 6 in a row ends the turn without moving.
- Landing on a square held by opponent tokens sends them back to their base ("cut"), and gives
  another roll. Nobody can be cut on a safe square.
- Safe squares: the 4 start squares and the 4 star squares (8 squares after each start).
- A token gets home only with an exact roll; a roll that would overshoot cannot move that token.
- Getting a token home gives another roll.
- If no token can move, the turn passes (after a 6, the player still rolls again).
- The first player with all 4 tokens home wins.

Assumptions not confirmed against Ludo King (each is one switch in `RuleSet`):
- `blocks: false` — two tokens of one colour on a square do not block; landing there cuts both.
- `playForPlaces: false` — the game ends at the first winner (switch on to play for 2nd and 3rd).

## Structure

```
games/ludo/
  packages/engine   pure rules: createGame, reduce(state, action) -> { state, events }, legalMoves,
                    botMove; seeded RNG (no Math.random, Date, timers, DOM or IO)
  apps/web          Vite + React: the doodle board, tokens, dice tower, sounds, bots, PWA
  packages/protocol room name, messages, the synced room view, step timings (PACE, stepPlaybackMs)
  apps/server       Colyseus room "ludo": LudoRoom, standalone on :2568 for now
```

Shared with every game: `packages/ui-doodle` (characters, dice tower, paper, filters, blink),
`packages/doodle-sound` (sound effects) and `packages/doodle-rooms` (room codes unique across games,
per-server abuse limits, names, reactions, static serving).

## Online (phase 2)

- A turn has two steps, each a server message (`step`): the roll, then the pick. A roll with only
  one possible move (`onlyChoice` in the engine) carries that move in the same step, as Ludo King
  moves by itself. Clients play steps back at their own pace; `stepPlaybackMs` tells the server
  when the next roll or pick may come.
- Each step gets the turn timer. When it runs out the server rolls for the player, or picks the
  bot's move for them. Bots and players who are away are played for after a short pause.
- The room syncs the public game (`gameJson`, no RNG) after every step, so a refresh or a
  reconnect redraws the board from the room alone.
- Run it: `pnpm --filter @ludo-doodle/web build && pnpm dev:ludo-server`, then
  http://localhost:2568 (the server serves the page too). `pnpm e2e:ludo` plays two browsers.
- For phase 3: the room is called "ludo" and Snakes & Ladders' is "game", and room codes are
  already unique across games, so one server can define both rooms.

## Phases

1. **Local game.** Engine with rule tests and property tests (games always end, tokens stay in
   range, nothing lost). Board, tokens, dice tower, pick-a-token, hop and cut animations, sounds,
   bots, house rules, win screen, PWA. Fast on iPhones: measure the move animation in WebKit
   (root CLAUDE.md rule: nothing animates inside a filtered group).
2. **Online rooms.** The Snakes & Ladders server pattern: authoritative room, code + share link,
   lobby with bots, turn timer, reconnect, reactions.
3. **Publish.** Next to Snakes & Ladders on games.shirishve.com (how the two share the address is
   decided with the owner then), in the same sealed-off container setup (docs/HOSTING.md).

## Progress

- 2026-10-30: plan written; phase 1 started.
- 2026-10-30: phase 1 done. Engine: 23 rule and property tests. Web: board geometry tests, the
  full game screen, bots, house rules, win screen, PWA icons. A 4-bot game runs to a winner in the
  browser with no errors. Sounds now come from the shared `packages/doodle-sound`.
  WebKit, 30 s of 4-bot play: frame p95 12 ms on a 390 px phone at 3x, 13-29 ms on desktop at 2x.
  Two findings: the 16 resting tokens (each sticker-filtered) need a sheet of their own, and the
  Snakes-style wake-up bounce at the handover had to go (it repainted every resting token, p95 80 ms).
- 2026-10-30: phase 2 done, not published (owner decides how it shares games.shirishve.com).
  Server: 12 room tests, among them a whole game with a bot and a player who is away. Browser:
  two-player e2e (room by link, reactions in lobby and game, refresh mid-game, picks, both screens
  agree). Found on the way: a `const` after the store's `return` is never initialised (a refresh
  mid-game crashed), and @colyseus/testing's boot() ignores its port for a ready-made Server.
- 2026-10-30: phase 3: published at https://games.shirishve.com/ludo/ (owner's choice: a
  "doodle games" page at / listing every game; each game under its own path, all on one server,
  `apps/server`). Snakes & Ladders moved to /snakes/; its old root worker is retired by /sw.js.
