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
 * Serves the built web client (apps/web/dist) from the game server, so one process and one port
 * carry the page and the game. Unknown paths get index.html, so links like /join/ABC123 open the app.
 * Express-style middleware signature, mounted on the WebSocket transport's app; it never touches
 * the Colyseus routes, which are matched before it.
 */
export function serveStatic(dir: string) {
  const root = resolve(dir);
  const index = join(root, "index.html");
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!existsSync(index)) return next();
    let path: string;
    try {
      path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    } catch {
      res.statusCode = 400;
      return res.end();
    }
    const file = normalize(join(root, path));
    // never serve outside the client folder
    const inside = file.startsWith(root + "/") || file === root;
    const isFile = inside && existsSync(file) && statSync(file).isFile();
    const target = isFile ? file : index;
    const ext = extname(target);
    res.setHeader("Content-Type", TYPES[ext] ?? "application/octet-stream");
    // hashed build assets never change; everything else (index.html, sw.js) must revalidate
    res.setHeader("Cache-Control", path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    if (req.method === "HEAD") return res.end();
    createReadStream(target).pipe(res);
  };
}
