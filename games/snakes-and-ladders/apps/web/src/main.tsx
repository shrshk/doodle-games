import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "@doodle-games/ui-doodle/doodle.css";
import "./styles.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the installed app. Production only: a service worker in dev would cache
// stale modules and fight Vite's hot reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => console.error("sw_register_failed", err));
  });
}
