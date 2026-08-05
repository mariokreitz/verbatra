/**
 * The dashboard browser entry point: it applies the stored theme, mounts the React app into the
 * `#root` container, and then hands off to the WebMCP adapter.
 *
 * The `registerAgentTools` call is fire-and-forget. It attaches the agent tools only when the
 * browser and the server-side opt-in both allow it and no-ops otherwise (see `registerAgentTools`
 * for the exact conditions), but it must never block or break the dashboard render. So its promise
 * is deliberately not awaited, and a rejected snapshot fetch at load is swallowed rather than left
 * as an unhandled rejection.
 */
import { createRoot } from "react-dom/client";
import { rpcParamsSchemas } from "../shared/rpc/contract.js";
import { type ModelContext, registerAgentTools } from "../webmcp/register-tools.js";
import { App } from "./App.js";
import { rpcClient } from "./api.js";
import { initTheme } from "./lib/theme-dom.js";
import "./styles.css";

declare global {
  interface Document {
    /** The WebMCP surface, present only in a WebMCP-capable browser; see the webmcp adapter. */
    readonly modelContext?: ModelContext;
  }
}

initTheme();

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(<App />);
}

registerAgentTools({
  modelContext: document.modelContext,
  rpcClient,
  schemas: rpcParamsSchemas,
}).catch(() => {});
