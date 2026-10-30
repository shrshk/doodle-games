import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { ROOM_NAME as LUDO_ROOM } from "@ludo-doodle/protocol";
import { ROOM_NAME as SNAKES_ROOM } from "@snakes-doodle/protocol";
import { createSiteServer } from "../src/app";

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  // a port of its own: the games' suites run at the same time
  const server = createSiteServer();
  await server.listen(2577);
  colyseus = new ColyseusTestServer(server);
});
afterAll(() => colyseus.shutdown());
afterEach(() => colyseus.cleanup());

it("hosts both games' rooms, and a code names one room whichever game it is", async () => {
  const snakes = await colyseus.sdk.create(SNAKES_ROOM, { name: "Ana" });
  const ludo = await colyseus.sdk.create(LUDO_ROOM, { name: "Bo" });
  await Promise.all([snakes.waitForInitialState(), ludo.waitForInitialState()]);
  expect(snakes.roomId).not.toBe(ludo.roomId);
  // joining by code needs no game name: the code alone finds the Ludo table
  const friend = await colyseus.sdk.joinById(ludo.roomId, { name: "Cy" });
  await friend.waitForInitialState();
  expect((friend.state as { toJSON(): { rulesJson: string } }).toJSON().rulesJson).toContain("needSixToStart");
});
