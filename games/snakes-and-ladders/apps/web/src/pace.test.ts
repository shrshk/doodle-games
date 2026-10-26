import { expect, it } from "vitest";
import { TOWER_MS } from "@doodle-games/ui-doodle";
import { PACE } from "@snakes-doodle/protocol";

it("the shared pace waits exactly as long as the dice tower drop", () => {
  expect(PACE.diceTumble).toBe(TOWER_MS);
});
