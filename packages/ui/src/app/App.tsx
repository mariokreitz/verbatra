import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { sessionStore } from "./api.js";
import { ConfigPanel } from "./panels/ConfigPanel.js";
import { DiffPanel } from "./panels/DiffPanel.js";
import { HistoryPanel } from "./panels/HistoryPanel.js";
import { LockPanel } from "./panels/LockPanel.js";
import { OverviewPanel } from "./panels/OverviewPanel.js";
import { StatusPanel } from "./panels/StatusPanel.js";

const TABS = ["overview", "status", "diff", "config", "lock", "history"] as const;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  overview: "Overview",
  status: "Status",
  diff: "Diff",
  config: "Config",
  lock: "Lock",
  history: "History",
};

const TAB_PANELS: Readonly<Record<Tab, () => ReactNode>> = {
  overview: OverviewPanel,
  status: StatusPanel,
  diff: DiffPanel,
  config: ConfigPanel,
  lock: LockPanel,
  history: HistoryPanel,
};

/**
 * The terminal, full-screen notice shown once the session is marked expired (G22): it never
 * clears itself and nothing in this component polls or retries; the only way out is a full page
 * reload from the loopback URL printed in the terminal.
 */
function SessionExpiredNotice(): ReactNode {
  return (
    <div role="alert">
      <h1>Session expired</h1>
      <p>Restart Verbatra Studio and open the URL printed in the terminal again.</p>
    </div>
  );
}

function isSessionExpired(): boolean {
  return sessionStore.getState().kind === "session-expired";
}

export function App(): ReactNode {
  const [tab, setTab] = useState<Tab>("overview");
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());

  useEffect(
    () => sessionStore.subscribe((state) => setSessionExpired(state.kind === "session-expired")),
    [],
  );

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  const ActivePanel = TAB_PANELS[tab];

  return (
    <div>
      <nav>
        {TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-current={candidate === tab}
            onClick={() => setTab(candidate)}
          >
            {TAB_LABELS[candidate]}
          </button>
        ))}
      </nav>
      <main>
        <ActivePanel />
      </main>
    </div>
  );
}
