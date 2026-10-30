import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Serves a built web client from a game server, so one process and one port carry the pages and
 * the games. `prefix` mounts it under a path ("/ludo" serves /ludo/...; requests elsewhere pass
 * on); "" mounts it at the root. Unknown page paths get index.html, so links like
 * /ludo/join/ABC123 open the app. Express-style middleware signature, mounted on the WebSocket
 * transport's app; it never touches the Colyseus routes, which are matched before it.
 */
export function serveStatic(dir: string, prefix = "") {
  const root = resolve(dir);
  const index = join(root, "index.html");
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!existsSync(index)) return next();
    let full: string;
    try {
      full = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    } catch {
      res.statusCode = 400;
      return res.end();
    }
    if (prefix && full === prefix) return redirect(res, `${prefix}/`);
    if (prefix && !full.startsWith(`${prefix}/`)) return next();
    // the path inside the client folder
    const path = full.slice(prefix.length);
    const file = normalize(join(root, path));
    // never serve outside the client folder
    const inside = file.startsWith(root + "/") || file === root;
    const isFile = inside && existsSync(file) && statSync(file).isFile();
    // icons and the manifest are what an install fetches: log them, so a blank home-screen icon
    // can be traced to what the phone actually asked for
    if (/icon|manifest/i.test(path)) {
      const agent = String(req.headers["user-agent"] ?? "").slice(0, 120);
      console.log(JSON.stringify({ t: new Date().toISOString(), event: "install_asset", path: full, found: isFile, agent }));
    }
    // a missing file is a 404, never the app: iOS probes /apple-touch-icon.png and /favicon.ico, and
    // an HTML page there (with 200) left the home-screen icon blank. Only page paths such as
    // /join/ABC123 (no extension) fall back to index.html.
    if (!isFile && extname(path) !== "") {
      res.statusCode = 404;
      return res.end();
    }
    const target = isFile ? file : index;
    const ext = extname(target);
    res.setHeader("Content-Type", TYPES[ext] ?? "application/octet-stream");
    // hashed build assets never change; everything else (index.html, sw.js) must revalidate
    res.setHeader("Cache-Control", path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    if (req.method === "HEAD") return res.end();
    createReadStream(target).pipe(res);
  };
}

function redirect(res: ServerResponse, to: string) {
  res.statusCode = 302;
  res.setHeader("Location", to);
  res.end();
}

/**
 * Sends `from` (an exact path) to `to`, and links of the form /join/CODE to `${joinTo}/join/CODE`:
 * share links made before a game moved under its own path keep working.
 */
export function redirects({ from, to, joinTo }: { from?: string; to?: string; joinTo?: string }) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const path = (req.url ?? "/").split("?")[0]!;
    if (from !== undefined && to !== undefined && path === from) return redirect(res, to);
    const join = /^\/join\/([A-Za-z0-9-]{4,12})\/?$/.exec(path);
    if (joinTo !== undefined && join) return redirect(res, `${joinTo}/join/${join[1]}`);
    next();
  };
}
