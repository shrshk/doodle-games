import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLudoServer } from "./app";
import { LudoRoom, REAL_TIMING } from "./rooms/LudoRoom";

// PORT and HOST pick where to listen (2568, beside Snakes & Ladders' 2567); CLIENT_DIR points at
// the built web client (defaults to apps/web/dist next to this package). TIMING_SCALE < 1 speeds
// up the intro, step playback and bots (not the turn timer), for end-to-end tests.
const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 2568);
const host = process.env.HOST ?? "0.0.0.0";
const clientDir = process.env.CLIENT_DIR ?? resolve(here, "../../web/dist");

const scale = Number(process.env.TIMING_SCALE ?? 1);
if (scale > 0 && scale !== 1) {
  const t = REAL_TIMING;
  LudoRoom.timing = {
    ...t,
    introMs: t.introMs * scale,
    playbackScale: scale,
    botThinkMinMs: t.botThinkMinMs * scale,
    botThinkMaxMs: t.botThinkMaxMs * scale,
    botPickMs: t.botPickMs * scale,
    awayActMs: t.awayActMs * scale,
  };
}

const server = createLudoServer({ clientDir });
await server.listen(port, host);
console.log(JSON.stringify({ event: "server_listening", game: "ludo", host, port, clientDir, timingScale: scale }));
