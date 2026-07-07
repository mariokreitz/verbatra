import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { refreshBus, sessionStore } from "./api.js";
import type { PanelProps } from "./panel-props.js";
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

// Every panel receives refreshToken, but StatusPanel is currently the only one that reacts to it
// (through the covered client/state.ts reducer); the rest ignore the prop for now, a deliberate,
// incremental scope choice rather than an oversight.
const TAB_PANELS: Readonly<Record<Tab, (props: PanelProps) => ReactNode>> = {
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
    <div className="session-expired" role="alert">
      <div className="session-expired-box">
        <h1>Session expired</h1>
        <p>Restart Verbatra Studio and open the URL printed in the terminal again.</p>
      </div>
    </div>
  );
}

function navItemClassName(isActive: boolean): string {
  return isActive ? "app-nav-item app-nav-item-active" : "app-nav-item";
}

function isSessionExpired(): boolean {
  return sessionStore.getState().kind === "session-expired";
}

export function App(): ReactNode {
  const [tab, setTab] = useState<Tab>("overview");
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());
  // Bumped once per live-refresh event (source, targets, or lock changed); passed to the active
  // panel so it can re-fetch. The event's own reason and timestamp are not needed here: every
  // panel re-fetches its own view wholesale rather than branching on which category changed.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(
    () => sessionStore.subscribe((state) => setSessionExpired(state.kind === "session-expired")),
    [],
  );
  useEffect(() => refreshBus.subscribe(() => setRefreshToken((token) => token + 1)), []);

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  const ActivePanel = TAB_PANELS[tab];

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">Verbatra Studio</div>
        <nav className="app-nav">
          {TABS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-current={candidate === tab}
              className={navItemClassName(candidate === tab)}
              onClick={() => setTab(candidate)}
            >
              {TAB_LABELS[candidate]}
            </button>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <h1 className="app-main-title">{TAB_LABELS[tab]}</h1>
        <div className="app-main-content">
          <ActivePanel refreshToken={refreshToken} />
        </div>
      </main>
    </div>
  );
}
