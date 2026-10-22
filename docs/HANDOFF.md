# Doodle Snakes & Ladders — Claude Code Handoff

Oct 18, 2026 · @Shirish Veerabattini

## Overview

Build a browser Snakes & Ladders game that looks like a crayon-and-colored-pencil doodle on paper, ships with a set of inbuilt boards, later lets players import a board from a photo, and finally supports online multiplayer on Colyseus. The visual reference is Kevin Ngo's "Chess but it looks like doodles on paper" video (made with Claude Sonnet 5.5); the look below is described from frames of that video.

**Goals**

- A complete, polished local game (2–4 players, pass-and-play, optional bots) that feels like a doodle come to life.
- Boards are pure data, so inbuilt, imported and community boards all use one renderer and one engine.
- The game engine is shared verbatim between client and server, so multiplayer adds transport, not new rules.

**Non-goals for v1**

- Accounts, payments, chat moderation, native mobile apps.
- Matchmaking with strangers (private room codes only at first).

**Roadmap at a glance:** Phase 1 local game and engine, Phase 2 inbuilt boards and board picker, Phase 3 board import from images, Phase 4 Colyseus multiplayer. Each phase ships on its own and is gated by the acceptance criteria in the phase plan.

## Visual direction

Match Kevin Ngo's "Chess but it looks like doodles on paper" video: a child's crayon-and-colored-pencil drawing come to life on a sheet of slightly crumpled cream paper. The board is hand-inked, the pieces are cute characters with faces, and the margins are full of little doodles that react to the game.

**What the reference shows, and how it maps to Snakes & Ladders**

| In the chess video | In our game |
| --- | --- |
| Dark-brown hand-inked 8×8 grid, slightly wobbly, drawn with a gentle perspective tilt like a sheet lying on a desk | Same grid style at 10×10 (or the board's size), same tilt |
| Dark squares filled with green colored-pencil diagonal hatching | Same alternating green hatching; snake and ladder squares stay readable over it |
| Coordinates a–h and 1–8 hand-lettered, alternating red and blue ink | Square numbers hand-lettered in each square corner, alternating red and blue |
| Pieces are crayon characters: mushroom pawns, a bee queen with crown and honey wand, an owl king, giraffe knights, blue blob creatures with leafy tufts | Player tokens are crayon characters: mushroom (red), bee (yellow), owl (orange), blue blob (indigo); same dot eyes and pink blush |
| Legal moves shown as hand-drawn orange circles with a leaf; hovered square gets orange corner brackets; selected piece gets a blue scribble loop | Destination square previewed as an orange leaf-circle; hover brackets; current player's token circled with a blue scribble |
| Pieces sketch themselves in: empty outline, then egg shape, then the full character | Board and tokens draw themselves in on load the same way |
| Margin doodles: rainbow, whale with a palm tree, sleeping potato creatures with "z", smiling sun, star bunting, clouds, little mushrooms | Same ambient margin doodles; snakes and ladders are drawn in the identical crayon style (snakes get cute faces and hatched stripes, ladders are brown pencil with uneven rungs) |
| Paper-slip notes and handwritten captions ("resign?", "sorry about the sprout", "the whale keeps the sleepers") | Paper-slip notes for prompts and reactions ("roll again?", "oops, snake!") and captions under the whale that change with events |
| Handwritten title cards that write themselves ("the opera game, paris 1858", "a queen sacrifice") | Board-name title card on game start and handwritten captions for big moments ("the longest snake") |
| "you win!" in red handwriting with "gg" and a star row | Same win screen |

**Palette** (sampled by eye from the video; tune against frames)

| Token | Hex | Use |
| --- | --- | --- |
| paper | #EEEAE0 | Cream page with a faint crease texture |
| ink | #3B2F2A | Grid lines and outlines (dark brown, never pure black) |
| hatch-green | #8DB27A | Dark-square hatching |
| crayon-red | #D9534A | Red numbers, mushroom caps, win text |
| crayon-blue | #3E3F9E | Blue numbers, blob creatures, selection scribble |
| marker-orange | #E3A84B | Destination circles, hover brackets |
| pencil-yellow | #E9C24A | Bee, sun, stars |

**Type**

- Handwriting for every label, note and title: a print-style hand such as Gochi Hand or Patrick Hand, and a looser cursive such as Caveat for captions and title cards (Google Fonts, with a cursive fallback).
- Vary rotation ±2–3° per label so nothing looks typeset.

**Rendering technique**

- Grid: SVG paths built from points with small seeded jitter, then a mild perspective transform (top edge narrower). Rough.js is fine for lines but not for the characters.
- Hatching: generate short diagonal pencil strokes per square, clipped to the square, seeded per board so every client sees the same marks.
- Characters, snakes, ladders and margin doodles: hand-authored layered SVG in `packages/ui-doodle` (outline path plus fill), with a shared pencil-texture filter (`feTurbulence` + `feDisplacementMap`, plus a grain pattern over fills). SVG keeps them animatable (blink, wiggle, squash on landing).
- Paper: a tiling cream texture with subtle creases and soft vignette; keep it under \~150 KB.
- If hand-drawing the character set in SVG is too slow, generate transparent PNG sprites at 2× as a stopgap, keeping the same names so they can be swapped later.

**Motion**

- On load, the grid strokes in (stroke-dashoffset), then hatching fills, then tokens appear as outline, egg, character.
- Dice: a doodled cube that tumbles \~600 ms and lands with pips drawn on.
- Moves hop square by square leaving a dotted ink trail; ladder climbs go rung by rung with a happy face; snake slides follow the body with a dizzy face.
- Margin doodles react: the sun smiles on a ladder, the sleeping potatoes wake on a snake, the whale's caption changes.
- One big moment: the "you win!" scribble with stars.
- Respect `prefers-reduced-motion`: instant moves, no self-drawing, no confetti.

The video is light-only; build light first and treat a dark "lamp-lit paper" theme as a later extra.

## Tech stack and repo structure

A TypeScript pnpm monorepo with one shared engine package used by the web client, the board importer and the Colyseus server.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) everywhere | One engine, one schema, client and server |
| Monorepo | pnpm workspaces + Turborepo | Shared packages, cached builds |
| Client | Vite + React 18 | Fast dev loop; SVG rendering suits React |
| Drawing | Rough.js + hand-written SVG paths | Doodle look with deterministic seeds |
| Animation | Framer Motion (or plain WAAPI) | Path-following moves, reduced-motion support |
| Client state | Zustand | Small store; mirrors engine state locally |
| Validation | Zod | Board JSON schema shared by editor, importer, server |
| Multiplayer | Colyseus 0.16 server + `colyseus.js` client, `@colyseus/schema` | Rooms, state sync, reconnection built in |
| Image import | Server endpoint calling a vision LLM (Claude) + client correction editor | Detect grid, snakes, ladders from a photo |
| Storage (Phase 3+) | Postgres (boards, imported images metadata) + S3-compatible bucket | Persist custom boards |
| Tests | Vitest, Playwright, `@colyseus/testing` | Unit, e2e, room tests |
| Deploy | Client on static hosting; server as a container (Fly.io/Render or EKS) | Colyseus needs sticky WebSocket sessions |

```
snakes-doodle/
  apps/
    web/                # Vite + React client
      src/board/        # SVG renderer, Rough.js wrappers, snake spline
      src/game/         # screens: home, picker, game, results
      src/editor/       # board editor + import correction UI (Phase 3)
      src/net/          # Colyseus client adapter (Phase 4)
    server/             # Colyseus + HTTP API (import endpoint, board CRUD)
      src/rooms/GameRoom.ts
      src/schema/       # @colyseus/schema state classes
      src/import/       # image -> board extraction
  packages/
    engine/             # pure rules: reducer, RNG, validation (no DOM, no IO)
    boards/             # board JSON schema (Zod) + inbuilt board files
    ui-doodle/          # reusable doodle primitives: buttons, dice, panels
  e2e/                  # Playwright
```

Rule of thumb: if it decides what happens in the game, it lives in `packages/engine`; if it draws something, it lives in `apps/web` or `packages/ui-doodle`.

## Game rules and engine

The engine is a pure reducer: `(state, action) -> { state, events }`, with a seeded RNG stored in state, so any game can be replayed exactly and the server can run the same code the client does.

**Default rules** (each is a toggle in `RuleSet`, set per game)

- 2–4 players; all tokens start off-board (square 0).
- Roll one d6, move forward that many squares.
- Landing on a ladder foot climbs to its top; landing on a snake head slides to its tail. No chaining unless `chainJumps` is on.
- Exact roll needed to land on the final square; overshoot either bounces back (`overshoot: "bounce"`) or forfeits the move (`"stay"`, default).
- Rolling a 6 grants another roll; three 6s in a row forfeits the turn (`sixRule`).
- Optional: need a 6 to enter the board (`startOnSix`, off by default).
- Multiple tokens may share a square.
- First to reach the final square wins; optional "play for places" continues until one player is left.

**Core types (sketch)**

```ts
type PlayerId = string;

interface GameState {
  boardId: string;
  rules: RuleSet;
  players: { id: PlayerId; name: string; color: string; position: number; isBot: boolean; finishedPlace?: number }[];
  turn: { playerId: PlayerId; consecutiveSixes: number; phase: "awaitingRoll" | "animating" | "gameOver" };
  rng: { seed: number; cursor: number };
  log: GameEvent[];
}

type Action =
  | { type: "ROLL"; playerId: PlayerId }
  | { type: "ANIMATION_DONE" }
  | { type: "SKIP_TURN"; playerId: PlayerId }   // timeout / disconnect
  | { type: "RESIGN"; playerId: PlayerId };

type GameEvent =
  | { type: "ROLLED"; playerId: PlayerId; value: number }
  | { type: "MOVED"; playerId: PlayerId; from: number; to: number; path: number[] }
  | { type: "LADDER"; playerId: PlayerId; from: number; to: number }
  | { type: "SNAKE"; playerId: PlayerId; from: number; to: number }
  | { type: "EXTRA_TURN" | "TURN_FORFEITED"; playerId: PlayerId }
  | { type: "WON"; playerId: PlayerId; place: number };
```

**Engine rules for implementers**

- No `Math.random`, `Date`, DOM or network in `packages/engine`. Use a small seeded PRNG (mulberry32 or sfc32) driven by `rng.seed` + `rng.cursor`.
- The client animates from the `events` list; it never computes moves itself.
- `validateBoard(board)` lives here too: no snake and ladder sharing a square, no jump into the start or final square, no loops if chaining is on, every square reachable.
- Bots: an easy bot just rolls after a short random delay; that's all Snakes & Ladders needs.

## Board data model and inbuilt boards

A board is a JSON file validated by one Zod schema; the renderer and engine read nothing else, so an imported photo board and a hand-made inbuilt board are interchangeable.

```ts
const Board = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),                       // slug, e.g. "classic-100"
  name: z.string(),
  author: z.string().default("inbuilt"),
  grid: z.object({
    rows: z.number().int().min(4).max(15),
    cols: z.number().int().min(4).max(15),
    layout: z.enum(["boustrophedon", "spiral", "custom"]).default("boustrophedon"),
    origin: z.enum(["bottom-left", "bottom-right"]).default("bottom-left"),
    customOrder: z.array(z.tuple([z.number(), z.number()])).optional() // [row, col] per square when layout = custom
  }),
  snakes:  z.array(z.object({ from: z.number(), to: z.number(), style: z.number().optional() })), // from > to
  ladders: z.array(z.object({ from: z.number(), to: z.number() })),                             // from < to
  decorations: z.array(z.object({ square: z.number(), doodle: z.string() })).optional(), // "star", "sun", "coffee-stain"…
  theme: z.object({ paper: z.enum(["ruled", "grid", "blank", "kraft"]), accent: z.string().optional() }).optional(),
  source: z.object({ kind: z.enum(["inbuilt", "imported", "editor"]), imageUrl: z.string().optional() }).optional()
});
```

Squares are numbered 1..rows×cols; geometry (square → x,y) is computed from `grid`, never stored. Snake curves and ladder angles are derived at render time from the seeded Rough.js generator.

**Inbuilt boards to ship in Phase 2**

| Board | Grid | Snakes / ladders | Character |
| --- | --- | --- | --- |
| Classic 100 | 10×10 | 8 / 8 | The traditional layout most people know; default board |
| Quick Doodle | 6×6 | 3 / 3 | 36 squares, a game in under five minutes, good for kids |
| Snake Pit | 10×10 | 14 / 5 | Mean board; long snakes near the top |
| Ladder Climb | 10×10 | 4 / 12 | Friendly board; short games |
| Spiral Notebook | 8×8 spiral | 6 / 6 | Path spirals inward like a notebook doodle |
| Moksha Patam | 9×8 (72) | 10 / 9 | Nod to the original Indian game; virtue/vice labels on squares |
| Big Sheet | 12×12 | 12 / 12 | 144 squares for long 4-player games |

Each board lives in `packages/boards/src/inbuilt/<id>.json`, has a hand-tuned layout (not random), and passes `validateBoard`. Add a script that simulates 10,000 games per board and reports median and 90th-percentile game length in turns, so boards can be balanced; target a median of 25–45 turns for 10×10 boards.

## Phase plan

Four phases, each shippable on its own; Phases 3 and 4 both depend only on Phase 2 and can run in either order. Criteria are written as checklists so Claude Code can tick them off.

**Phase 1 — Local game and engine**

- [x] Monorepo scaffolded; `pnpm dev`, `pnpm test`, `pnpm build` work from the root.
- [x] Engine reducer covers every rule in "Game rules and engine" with tests passing.
- [x] Classic 100 renders in the doodle style; wobble is identical across reloads.
- [x] 2–4 players pass-and-play, bots optional, dice and move animations, win screen.
- [x] Mobile layout, keyboard roll, reduced motion.

**Phase 2 — Inbuilt boards and picker**

- [x] All seven inbuilt boards added, each passing `validateBoard` and the balance simulation.
- [x] Board picker drawn as doodled thumbnails on a notebook page; rule toggles on the setup screen.
- [x] Spiral layout supported by the renderer and engine.
- [x] Last-used board and rules remembered in `localStorage`.

**Phase 3 — Board editor and image import**

- [ ] Board editor: set grid, numbering, and add, drag or delete snakes and ladders, with live validation.
- [ ] Upload → corner marking → perspective correction in the browser.
- [ ] `/api/boards/import` returns schema-valid JSON with per-item confidence; low-confidence items are flagged.
- [ ] Imported and hand-made boards save to Postgres and appear in the picker under "My boards".
- [ ] Fixture photos: at least 80% of snakes and ladders detected correctly before manual correction.

**Phase 4 — Colyseus multiplayer**

- [ ] `GameRoom` runs the shared engine; clients only send `roll`.
- [ ] Create room → join by code or link → lobby → start → finish, across two browsers.
- [ ] Turn timer with auto-roll; reconnection within 120 s restores the seat.
- [ ] Custom and imported boards playable online (validated server-side).
- [ ] Room tests and a two-browser Playwright test pass in CI; server container builds and deploys.

## Board import from images

A player photographs any Snakes & Ladders board (store-bought, a kid's drawing, a screenshot); a vision model proposes the grid, snakes and ladders as board JSON, and the player fixes anything wrong in an editor before saving. The model is a first draft, never the final word.

**Pipeline**

1. **Upload** (client): accept JPEG/PNG/HEIC up to 10 MB; let the player drag four corner handles to mark the board, then perspective-correct it in the browser (OpenCV.js `getPerspectiveTransform` or a small homography helper) and downscale to \~1600 px.
2. **Extract** (server, `POST /api/boards/import`): send the rectified image to Claude with a strict JSON-only prompt asking for grid size, numbering direction, the square number at each snake head/tail and ladder foot/top, and a confidence per item. Parse with the same Zod `Board` schema; retry once with the validation errors if parsing fails.
3. **Sanity-check** (server): run `validateBoard`; flag items whose squares conflict, whose numbers fall outside the grid, or whose confidence is below 0.6.
4. **Correct** (client editor): overlay the doodle-rendered board on the photo at 50% opacity; flagged items pulse. The player can drag snake/ladder endpoints between squares, add or delete items, and change grid size or numbering origin.
5. **Save**: store the board JSON in Postgres with `source.kind = "imported"`; keep the original image in the bucket only if the player opts in. The saved board is redrawn in the doodle style, not shown as the photo.

**Prompt contract (server)**

- System prompt states the output schema exactly and says to return only JSON, no prose or fences.
- Ask the model to read printed square numbers rather than infer them, and to report `numberingOrigin` and whether rows alternate.
- Ask for `{ from, to, confidence }` per snake and ladder; snakes go down, ladders go up; the server swaps reversed pairs and flags them.

**Fallbacks and limits**

- If the board has no printed numbers, the model returns grid geometry only and the player places items manually in the editor.
- Rate-limit imports per user (e.g. 10/day) and cap image size; strip EXIF before upload.
- The editor doubles as a from-scratch board maker, so Phase 3 also delivers "Draw your own board".

The API key stays on the server; the browser never calls the model directly.

## Multiplayer with Colyseus

The server is authoritative: clients send intents (`roll`), the `GameRoom` runs the shared engine reducer, and Colyseus syncs the resulting state and events to everyone. Clients never roll dice locally in online games.

**Room design**

- One room type, `game`, created with `{ boardId | board, rules, maxPlayers }`. Custom boards are validated server-side before the room opens.
- Private rooms by default: a 6-character join code (`filterBy(["code"])`), shareable as a link `/join/ABC123`.
- Lobby phase inside the room: players pick colour and name, host can add bots and press Start. Spectators allowed beyond `maxPlayers`.
- Room auto-disposes 60 s after the last client leaves.

**State schema** (`@colyseus/schema`, mirrors the engine's `GameState`)

```ts
class PlayerState extends Schema {
  @type("string") id; @type("string") name; @type("string") color;
  @type("uint8") position = 0; @type("boolean") connected = true;
  @type("boolean") isBot = false; @type("uint8") place = 0;
}
class GameRoomState extends Schema {
  @type("string") phase = "lobby";            // lobby | playing | finished
  @type("string") boardId; @type("string") boardJson; // full board sent once
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("string") currentPlayerId; @type("uint8") lastRoll = 0;
  @type("number") turnDeadline = 0;           // epoch ms, for the turn timer
}
```

Keep the RNG seed and log server-side only. Broadcast each turn's `GameEvent[]` as a message (`room.broadcast("events", events)`) so clients animate the same sequence; schema state is the source of truth for positions after animation.

**Turn flow**

1. Client sends `roll` → server checks it is that player's turn and phase is `playing`.
2. Server runs `reduce(state, ROLL)`, applies the result to the schema, broadcasts events, sets the next `turnDeadline` (20 s default).
3. If the deadline passes, the server auto-rolls for that player (or skips, per room setting); bots roll after 0.8–1.5 s.

**Reconnection and resilience**

- `onLeave` with `allowReconnection(client, 120)`; the player shows as disconnected and is auto-rolled while away.
- Store `reconnectionToken` in `sessionStorage` on the client to resume after a refresh.
- Rate-limit `roll` messages and ignore anything out of turn; never trust client positions.

**Scaling and deploy**

- Start with a single Colyseus process; move to multiple processes with the Redis presence and driver when needed.
- WebSockets need sticky routing; behind an ALB or ingress, enable session affinity.
- Use `@colyseus/monitor` in non-prod and `@colyseus/testing` for room tests.

Pin the exact Colyseus version at setup and follow its current docs; decorator syntax and some APIs changed between 0.15 and 0.16.

## Testing, quality bar and open questions

**Testing**

- Engine: Vitest unit tests for every rule toggle, plus property tests (fast-check) that games always terminate and positions stay in range.
- Boards: every inbuilt board passes `validateBoard` and the balance simulation in CI.
- Replay test: a recorded seed + action list reproduces the identical event log on client and server builds.
- Rooms: `@colyseus/testing` for join, start, out-of-turn roll rejected, timeout auto-roll, reconnect within 120 s.
- E2E: Playwright for local pass-and-play and a two-browser online game.
- Import: a fixture set of 10–15 board photos with expected JSON; track how many items the model gets right without correction.

**Quality bar**

- Works from 360 px phones to desktop; board scales to fit, controls reachable with a thumb.
- Light theme first (dark is a later extra); keyboard play (Space/Enter to roll) with visible focus; screen-reader announcements for rolls and jumps.
- 60 fps animations on a mid-range phone; first load under 300 KB gzipped excluding fonts.

**Open questions**

- Should imported boards be shareable with other players by link, or stay private to the uploader?
- Online play: private room codes only, or also quick-match with strangers later?
- Where should the server run: a small container host to start, or the existing EKS setup?

## Kickoff prompt for Claude Code

Export this doc as Markdown, save it as `docs/HANDOFF.md` in an empty repo, put the reference video frames in docs/reference/, then paste the prompt below into Claude Code.

```markdown
Read docs/HANDOFF.md fully and look at every image in docs/reference/ (frames from the style reference video) before writing code. We are building "Doodle Snakes & Ladders".

Work phase by phase. Do Phase 1 now and stop at its acceptance criteria; do not start Phase 2.

1. Scaffold the pnpm + Turborepo monorepo exactly as in "Tech stack and repo structure".
2. Implement packages/engine as a pure reducer with a seeded PRNG (no Math.random, Date, DOM or IO).
   Write Vitest tests for every rule toggle and a fast-check property test that games terminate.
3. Implement packages/boards with the Zod Board schema and the Classic 100 board only.
4. Build apps/web: crumpled cream paper, tilted hand-inked grid with green hatching, crayon snakes and ladders,
   doodle dice, crayon character tokens with self-drawing intro, 2-4 player pass-and-play, optional bots, win screen.
   Follow the palette, fonts and motion rules in "Visual direction", including reduced motion.
5. Add a CLAUDE.md capturing conventions: engine purity, where code lives, how to run tests.

Before finishing: run lint, typecheck and all tests; list anything in the handoff you deviated from and why.
Ask me before adding any dependency not listed in the handoff.
```

For later phases, reuse the same prompt with "Do Phase N now" and the matching section names.
