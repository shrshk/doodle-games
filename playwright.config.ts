import { defineConfig, devices } from "@playwright/test";

// The production server, as the Docker image runs it: the hub at /, each game under its path and
// every game's rooms on one port. TIMING_SCALE speeds the server's pacing up, and the browsers ask
// for reduced motion, so games play in seconds.
const PORT = 2580;

export default defineConfig({
  timeout: 180_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "hub", testDir: "e2e" },
    { name: "snakes", testDir: "games/snakes-and-ladders/e2e" },
    { name: "ludo", testDir: "games/ludo/e2e" },
  ],
  webServer: {
    command: `pnpm build && PORT=${PORT} TIMING_SCALE=0.05 node apps/server/dist/index.js`,
    url: `http://localhost:${PORT}/__healthcheck`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
