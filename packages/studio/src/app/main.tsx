/**
 * The dashboard browser entry point: it applies the stored theme, mounts the React app into the
 * `#root` container, and then hands off to the WebMCP adapter.
 *
 * The `registerAgentTools` call is fire-and-forget. It attaches the agent tools only when the
 * browser and the server-side opt-in both allow it and no-ops otherwise (see `registerAgentTools`
 * for the exact conditions), but it must never block or break the dashboard render, so its promise
 * is deliberately not awaited.
 *
 * Not awaited is not the same as not observed. Its outcome is reported to the console and published
 * to the store the dashboard's degraded-mode notice reads, so a failed registration names itself
 * instead of leaving a surface that merely appears to do nothing. The trailing `catch` covers the
 * pass that never reached the per-tool loop at all, a rejected snapshot fetch at load being the
 * likely case; a failure of one tool is not a rejection and travels in the report instead.
 */
import { createRoot } from "react-dom/client";
import { rpcParamsSchemas } from "../shared/rpc/contract.js";
import { type ModelContext, registerAgentTools } from "../webmcp/register-tools.js";
import {
  reportAgentToolsRegistration,
  reportAgentToolsStartupFailure,
} from "../webmcp/registration-report.js";
import { App } from "./App.js";
import { agentToolsStatusStore, rpcClient } from "./api.js";
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
})
  .then((registration) => {
    reportAgentToolsRegistration(registration);
    agentToolsStatusStore.publish(registration.failures);
  })
  .catch(reportAgentToolsStartupFailure);
