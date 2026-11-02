import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "@doodle-games/ui-doodle/doodle.css";
import { startTvRemote } from "@doodle-games/ui-doodle";
import "./hub.css";
import { Hub } from "./Hub";

startTvRemote(); // ?tv=1 (the TV app): arrows move between controls

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);
