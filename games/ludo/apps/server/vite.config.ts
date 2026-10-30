import { defineConfig } from "vite";

// Bundles the server for Node: the workspace packages (TypeScript source) are compiled in, real
// npm packages stay external and load from node_modules.
export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    ssr: "src/index.ts",
    rollupOptions: { output: { format: "es", entryFileNames: "index.js" } },
  },
  ssr: { noExternal: [/^@ludo-doodle\//, /^@doodle-games\//] },
});
