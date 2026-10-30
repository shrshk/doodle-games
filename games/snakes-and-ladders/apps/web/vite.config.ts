import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The commit a build came from, shown small on the start page: an installed PWA can keep running
// an old build, and this is how to tell which one a device has.
function buildId(): string {
  // the Docker build has no .git: it passes the commit in as BUILD_ID
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  // served under /snakes/ next to the other games and the hub page at /
  base: "/snakes/",
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: 5173 },
  // reachable from a phone on the same Wi-Fi (Bonjour name) or over Tailscale
  preview: { port: 4173, allowedHosts: [".local", ".ts.net"] },
});
