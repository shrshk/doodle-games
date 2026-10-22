import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // reachable from a phone on the same Wi-Fi (Bonjour name) or over Tailscale
  preview: { port: 4173, allowedHosts: [".local", ".ts.net"] },
});
