import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { redirects, serveStatic } from "../src/static";

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

describe("several clients on one server: a game under its path, the hub at the root", () => {
  let site: Server;
  let url = "";
  beforeAll(async () => {
    const hub = mkdtempSync(join(tmpdir(), "doodle-hub-"));
    writeFileSync(join(hub, "index.html"), "hub");
    writeFileSync(join(hub, "sw.js"), "hub worker");
    const ludo = mkdtempSync(join(tmpdir(), "doodle-ludo-"));
    writeFileSync(join(ludo, "index.html"), "ludo");
    writeFileSync(join(ludo, "sw.js"), "ludo worker");
    mkdirSync(join(ludo, "assets"));
    writeFileSync(join(ludo, "assets", "app-1a2b.js"), "js");
    const chain = [redirects({ joinTo: "/snakes" }), serveStatic(ludo, "/ludo"), serveStatic(hub)];
    site = createServer((req, res) => {
      const run = (i: number): void => {
        if (i < chain.length) chain[i]!(req, res, () => run(i + 1));
        else res.writeHead(404).end();
      };
      run(0);
    });
    await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
    const addr = site.address();
    url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(() => new Promise<void>((r) => site.close(() => r())));
  const get = (path: string) => fetch(url + path, { redirect: "manual" });

  it("serves each client's own files, the game's under its path", async () => {
    expect(await (await get("/")).text()).toBe("hub");
    expect(await (await get("/sw.js")).text()).toBe("hub worker");
    expect(await (await get("/ludo/")).text()).toBe("ludo");
    expect(await (await get("/ludo/sw.js")).text()).toBe("ludo worker");
    expect(await (await get("/ludo/join/ABC234")).text()).toBe("ludo");
    const asset = await get("/ludo/assets/app-1a2b.js");
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });

  it("adds the slash to a bare game path, and sends old /join links to the game they came from", async () => {
    const bare = await get("/ludo");
    expect([bare.status, bare.headers.get("location")]).toEqual([302, "/ludo/"]);
    const old = await get("/join/ABC234");
    expect([old.status, old.headers.get("location")]).toEqual([302, "/snakes/join/ABC234"]);
  });

  it("does not let a game path reach the hub's files, or a missing game file fall back to a page", async () => {
    expect((await get("/ludo/nope.js")).status).toBe(404);
    expect((await get("/ludo-extra/x")).status).toBe(200); // not the game's path: the hub's page
    expect(await (await get("/ludo-extra/x")).text()).toBe("hub");
  });
});
