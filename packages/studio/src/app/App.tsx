import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isPaletteShortcut } from "../client/command-palette.js";
import {
  handleRefreshEvent,
  nextToastSlot,
  type RefreshToastView,
} from "../client/refresh-toast.js";
import { refreshBus, sessionStore } from "./api.js";
import { CommandPalette } from "./CommandPalette.js";
import type { PanelProps } from "./panel-props.js";
import { DiffPanel } from "./panels/DiffPanel.js";
import { HistoryPanel } from "./panels/HistoryPanel.js";
import { LockPanel } from "./panels/LockPanel.js";
import { OverviewPanel } from "./panels/OverviewPanel.js";
import { ReviewPanel } from "./panels/ReviewPanel.js";
import { StatusPanel } from "./panels/StatusPanel.js";
import { UsagePanel } from "./panels/UsagePanel.js";
import { RefreshToast } from "./RefreshToast.js";

const TABS = ["overview", "status", "diff", "review", "usage", "lock", "history"] as const;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  overview: "Overview",
  status: "Status",
  diff: "Diff",
  review: "Review",
  usage: "Usage",
  lock: "Lock",
  history: "History",
};

// Every panel receives refreshToken. StatusPanel reacts to it directly (through the covered
// client/state.ts reducer); DiffPanel passes it straight through to an open KeyDetailDrawer,
// which re-fetches its own key.integrity view on change. ReviewPanel and UsagePanel react to it
// the same way StatusPanel does, re-fetching review.queue/usage.summary on every live-refresh
// event. The remaining panels ignore the prop for now, a deliberate, incremental scope choice
// rather than an oversight. The refresh toast below is a second, independent reaction to the
// same live-refresh event.
const TAB_PANELS: Readonly<Record<Tab, (props: PanelProps) => ReactNode>> = {
  overview: OverviewPanel,
  status: StatusPanel,
  diff: DiffPanel,
  review: ReviewPanel,
  usage: UsagePanel,
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
  // One toast slot (client/refresh-toast.ts's own one-slot rule): a new refresh event always
  // replaces whatever is shown, including clearing it entirely for an event with nothing to
  // report; a dismiss always clears it without ever calling the translate-pending action.
  const [toast, setToast] = useState<RefreshToastView | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(
    () => sessionStore.subscribe((state) => setSessionExpired(state.kind === "session-expired")),
    [],
  );
  useEffect(
    () =>
      refreshBus.subscribe((event) => {
        const handled = handleRefreshEvent(event);
        if (handled.bumpToken) {
          setRefreshToken((token) => token + 1);
        }
        setToast(handled.toast);
      }),
    [],
  );

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

  function handleDismissToast(): void {
    setToast((current) => nextToastSlot(current, { kind: "dismiss" }));
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
      {toast !== undefined ? <RefreshToast view={toast} onDismiss={handleDismissToast} /> : null}
    </div>
  );
}
