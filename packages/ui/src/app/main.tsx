import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(<App />);
}
