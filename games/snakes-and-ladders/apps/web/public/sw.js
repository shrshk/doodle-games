// Offline support for one game, served from that game's path (e.g. /snakes/sw.js, scope /snakes/).
// Hashed build assets are cache-first (their names change when they change), page navigations are
// network-first with the cached shell as the offline fallback, and Google Fonts are
// stale-while-revalidate. Every game shares the site's cache storage, so cache names carry the
// game's path. Bump VERSION to drop old caches.
const VERSION = "v2";
const BASE = new URL("./", self.location).pathname;
const SHELL = `${BASE}shell-${VERSION}`;
const ASSETS = `${BASE}assets-${VERSION}`;
const FONTS = `${BASE}fonts-${VERSION}`;
const START = new URL("./", self.location).href;
const PRECACHE = ["./", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, ASSETS, FONTS]);
  event.waitUntil(
    caches
      .keys()
      // only this game's old caches: the other games' live beside them
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(BASE) && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL)).put(START, response.clone());
    return response;
  } catch {
    return (await caches.match(START)) ?? Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONTS);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // the game server's own endpoints are live data, never cached
  if (url.pathname.startsWith("/matchmake") || url.pathname.startsWith("/__")) return;
  if (request.mode === "navigate") return event.respondWith(networkFirst(request));
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    return event.respondWith(cacheFirst(request, url.pathname.startsWith(`${BASE}assets/`) ? ASSETS : SHELL));
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    return event.respondWith(staleWhileRevalidate(request));
  }
});
