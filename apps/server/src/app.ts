import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { redirects, serveStatic } from "@doodle-games/rooms/server";
import { ROOM_NAME as LUDO_ROOM } from "@ludo-doodle/protocol";
import { LudoRoom } from "@ludo-doodle/server/room";
import { ROOM_NAME as SNAKES_ROOM } from "@snakes-doodle/protocol";
import { GameRoom } from "@snakes-doodle/server/room";

/** The built web clients: the hub page at / and each game under its own path. */
export interface ClientDirs {
  hub: string;
  snakes: string;
  ludo: string;
}

/**
 * Every game on one server and one port: the rooms of both games, the hub page at /, Snakes &
 * Ladders under /snakes/ and Ludo under /ludo/. Room codes are unique across the games, so a code
 * names one room whichever game it is. Omit `clients` to serve only the rooms.
 */
export function createSiteServer({ clients }: { clients?: ClientDirs } = {}): Server {
  const transport = new WebSocketTransport();
  // Mount the clients before the Server exists: Colyseus checks at construction whether the app
  // already answers "/", and only adds its own banner page there if it does not.
  if (clients) {
    transport
      .getExpressApp()
      // Snakes & Ladders lived at / before the hub: its share links were /join/CODE
      .use(redirects({ joinTo: "/snakes" }))
      .use(serveStatic(clients.snakes, "/snakes"))
      .use(serveStatic(clients.ludo, "/ludo"))
      .use(serveStatic(clients.hub));
  }
  const server = new Server({ transport, greet: false, express: () => {} });
  server.define(SNAKES_ROOM, GameRoom);
  server.define(LUDO_ROOM, LudoRoom);
  return server;
}
