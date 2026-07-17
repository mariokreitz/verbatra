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

// Fire-and-forget: registers the WebMCP agent tools when the browser and the opt-in both allow it,
// and no-ops otherwise. It must never block or break the dashboard render, so a rejected snapshot
// fetch at load is swallowed rather than left as an unhandled rejection.
registerAgentTools({
  modelContext: document.modelContext,
  rpcClient,
  schemas: rpcParamsSchemas,
}).catch(() => {});
