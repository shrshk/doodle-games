import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { redirects, serveStatic } from "@doodle-games/rooms/server";
import { ROOM_NAME } from "@ludo-doodle/protocol";
import { LudoRoom } from "./rooms/LudoRoom";

export interface AppOptions {
  /** built web client to serve on the same port; omit to serve only the game */
  clientDir?: string;
}

export function createLudoServer({ clientDir }: AppOptions = {}): Server {
  const transport = new WebSocketTransport();
  // Mount the client before the Server exists: Colyseus checks at construction whether the app
  // already answers "/", and only adds its own banner page there if it does not.
  // the client lives under /ludo/, as on the shared server; / and old /join links lead there
  if (clientDir) transport.getExpressApp().use(redirects({ from: "/", to: "/ludo/", joinTo: "/ludo" })).use(serveStatic(clientDir, "/ludo"));
  const server = new Server({ transport, greet: false, express: () => {} });
  server.define(ROOM_NAME, LudoRoom);
  return server;
}
