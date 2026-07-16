import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initTheme } from "./lib/theme-dom.js";
import "./styles.css";

// Before the first render, so the first painted frame already carries the right theme (no
// dark-to-light flash). Runs in the bundle rather than an inline script: the server's CSP
// forbids inline scripts, and nothing renders before this module executes anyway.
initTheme();

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(<App />);
}
