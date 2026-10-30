import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The commit a build came from, shown small on the start page: an installed PWA can keep running
// an old build, and this is how to tell which one a device has.
function buildId(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  // served under /ludo/ next to the other games and the hub page at /
  base: "/ludo/",
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: 5176 },
  preview: { port: 4176, allowedHosts: [".local", ".ts.net"] },
});
