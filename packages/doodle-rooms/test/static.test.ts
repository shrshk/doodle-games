import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { serveStatic } from "../src/static";

let server: Server;
let base = "";
beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "doodle-static-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>app</title>");
  mkdirSync(join(dir, "icons"));
  writeFileSync(join(dir, "icons", "icon.png"), "png");
  const handle = serveStatic(dir);
  server = createServer((req, res) => handle(req, res, () => ((res.statusCode = 404), res.end())));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

it("serves files and answers page paths with the app", async () => {
  const icon = await fetch(`${base}/icons/icon.png`);
  expect([icon.status, icon.headers.get("content-type")]).toEqual([200, "image/png"]);
  const page = await fetch(`${base}/join/ABC234`);
  expect([page.status, await page.text()]).toEqual([200, "<!doctype html><title>app</title>"]);
});

it("answers a missing file with 404, not the app (iOS icon probes)", async () => {
  for (const path of ["/apple-touch-icon.png", "/favicon.ico", "/icons/nope.png"]) {
    expect((await fetch(base + path)).status).toBe(404);
  }
});

it("never serves outside the client folder", async () => {
  const res = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
  // a path that climbs out is treated as a page path: the app, never the file it names
  expect(await res.text()).toBe("<!doctype html><title>app</title>");
});
