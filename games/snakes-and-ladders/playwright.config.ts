import { defineConfig, devices } from "@playwright/test";

// One game server serves the built client and the rooms, as in production. TIMING_SCALE speeds the
// server's pacing up, and the browsers ask for reduced motion, so a whole game takes seconds.
const PORT = 2580;

export default defineConfig({
  testDir: "e2e",
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
  webServer: {
    // from the repo root, where the workspace is
    cwd: "../..",
    command: `pnpm build && PORT=${PORT} TIMING_SCALE=0.05 node games/snakes-and-ladders/apps/server/dist/index.js`,
    url: `http://localhost:${PORT}/__healthcheck`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
