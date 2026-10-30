// Retires the site root's old offline worker. Snakes & Ladders used to live at / with a worker at
// /sw.js controlling the whole site; it now lives at /snakes/ with its own worker there. Browsers
// that still run the old one fetch this file on their next visit: it deletes the old caches,
// unregisters itself and reloads its pages from the network. The hub itself needs no worker.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // the old worker's cache names; each game's worker now names its own after its path
      await Promise.all(["shell-v1", "assets-v1", "fonts-v1"].map((name) => caches.delete(name)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((w) => w.navigate(w.url));
    })(),
  );
});
