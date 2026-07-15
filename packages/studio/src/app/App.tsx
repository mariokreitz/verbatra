import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isPaletteShortcut } from "../client/command-palette.js";
import { refreshBus, sessionStore } from "./api.js";
import { CommandPalette } from "./CommandPalette.js";
import type { PanelProps } from "./panel-props.js";
import { DiffPanel } from "./panels/DiffPanel.js";
import { HistoryPanel } from "./panels/HistoryPanel.js";
import { LockPanel } from "./panels/LockPanel.js";
import { OverviewPanel } from "./panels/OverviewPanel.js";
import { StatusPanel } from "./panels/StatusPanel.js";

const TABS = ["overview", "status", "diff", "lock", "history"] as const;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  overview: "Overview",
  status: "Status",
  diff: "Diff",
  lock: "Lock",
  history: "History",
};

// Every panel receives refreshToken. StatusPanel reacts to it directly (through the covered
// client/state.ts reducer); DiffPanel passes it straight through to an open KeyDetailDrawer,
// which re-fetches its own key.integrity view on change. The remaining panels ignore the prop for
// now, a deliberate, incremental scope choice rather than an oversight.
const TAB_PANELS: Readonly<Record<Tab, (props: PanelProps) => ReactNode>> = {
  overview: OverviewPanel,
  status: StatusPanel,
  diff: DiffPanel,
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(
    () => sessionStore.subscribe((state) => setSessionExpired(state.kind === "session-expired")),
    [],
  );
  useEffect(() => refreshBus.subscribe(() => setRefreshToken((token) => token + 1)), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (sessionExpired) {
    return <SessionExpiredNotice />;
  }

  const ActivePanel = TAB_PANELS[tab];

  // The palette only ever resolves a selection to one of `TABS`'s own values (see
  // `buildPaletteCommands`, which builds every tab command from this same list), so this cast is
  // sound even though the palette's own types stay generic over `string`, independent of App's Tab
  // union (client modules do not depend on app-layer types).
  function handleSelectTab(nextTab: string): void {
    setTab(nextTab as Tab);
  }

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
      {paletteOpen ? (
        <CommandPalette
          tabs={TABS.map((id) => ({ tab: id, label: TAB_LABELS[id] }))}
          onSelectTab={handleSelectTab}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
    </div>
  );
}
