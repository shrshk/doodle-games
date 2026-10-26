import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@snakes-doodle/protocol";
import { GameRoom } from "./rooms/GameRoom";
import { serveStatic } from "./static";

export interface AppOptions {
  /** built web client to serve on the same port; omit to serve only the game */
  clientDir?: string;
}

export function createGameServer({ clientDir }: AppOptions = {}): Server {
  const transport = new WebSocketTransport();
  // Mount the client before the Server exists: Colyseus checks at construction whether the app
  // already answers "/", and only adds its own banner page there if it does not.
  if (clientDir) transport.getExpressApp().use(serveStatic(clientDir));
  const server = new Server({ transport, greet: false, express: () => {} });
  server.define(ROOM_NAME, GameRoom);
  return server;
}
