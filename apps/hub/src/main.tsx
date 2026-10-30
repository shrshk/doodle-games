import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "@doodle-games/ui-doodle/doodle.css";
import "./hub.css";
import { Hub } from "./Hub";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);
