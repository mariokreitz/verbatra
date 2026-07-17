import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initTheme } from "./lib/theme-dom.js";
import "./styles.css";

initTheme();

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(<App />);
}
