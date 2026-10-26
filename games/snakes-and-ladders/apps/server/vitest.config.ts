import { defineConfig } from "vitest/config";

// Threads, not the default child processes: Colyseus treats a process with an IPC channel as a
// cluster worker and talks over it, which garbles Vitest's own messages on that channel.
export default defineConfig({ test: { pool: "threads", testTimeout: 20000 } });
