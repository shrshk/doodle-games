import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameServer } from "./app";
import { GameRoom, REAL_TIMING } from "./rooms/GameRoom";

// PORT and HOST pick where to listen; CLIENT_DIR points at the built web client (defaults to
// apps/web/dist next to this package, which is where `pnpm build` puts it). TIMING_SCALE < 1 speeds
// up the intro, turn playback and bots (not the turn timer), for end-to-end tests.
const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";
const clientDir = process.env.CLIENT_DIR ?? resolve(here, "../../web/dist");

const scale = Number(process.env.TIMING_SCALE ?? 1);
if (scale > 0 && scale !== 1) {
  const t = REAL_TIMING;
  GameRoom.timing = {
    ...t,
    introMs: t.introMs * scale,
    playbackScale: scale,
    botThinkMinMs: t.botThinkMinMs * scale,
    botThinkMaxMs: t.botThinkMaxMs * scale,
    awayRollMs: t.awayRollMs * scale,
  };
}

const server = createGameServer({ clientDir });
await server.listen(port, host);
console.log(JSON.stringify({ event: "server_listening", host, port, clientDir, timingScale: scale }));
