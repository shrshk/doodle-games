import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LudoRoom, REAL_TIMING as LUDO_TIMING } from "@ludo-doodle/server/room";
import { GameRoom, REAL_TIMING as SNAKES_TIMING } from "@snakes-doodle/server/room";
import { createSiteServer } from "./app";

// The production server (the Docker image runs this). PORT and HOST pick where to listen;
// CLIENTS_DIR holds the built clients as hub/, snakes/ and ludo/ (default: each package's dist in
// this repo). TIMING_SCALE < 1 speeds up intros, playback and bots (not turn timers), for
// end-to-end tests.
const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";
const root = process.env.CLIENTS_DIR;
const clients = root
  ? { hub: resolve(root, "hub"), snakes: resolve(root, "snakes"), ludo: resolve(root, "ludo") }
  : {
      hub: resolve(here, "../../hub/dist"),
      snakes: resolve(here, "../../../games/snakes-and-ladders/apps/web/dist"),
      ludo: resolve(here, "../../../games/ludo/apps/web/dist"),
    };

const scale = Number(process.env.TIMING_SCALE ?? 1);
if (scale > 0 && scale !== 1) {
  const s = SNAKES_TIMING;
  GameRoom.timing = {
    ...s,
    introMs: s.introMs * scale,
    playbackScale: scale,
    botThinkMinMs: s.botThinkMinMs * scale,
    botThinkMaxMs: s.botThinkMaxMs * scale,
    awayRollMs: s.awayRollMs * scale,
  };
  const l = LUDO_TIMING;
  LudoRoom.timing = {
    ...l,
    introMs: l.introMs * scale,
    playbackScale: scale,
    botThinkMinMs: l.botThinkMinMs * scale,
    botThinkMaxMs: l.botThinkMaxMs * scale,
    botPickMs: l.botPickMs * scale,
    awayActMs: l.awayActMs * scale,
  };
}

const server = createSiteServer({ clients });
await server.listen(port, host);
console.log(JSON.stringify({ event: "server_listening", host, port, clients, timingScale: scale }));
